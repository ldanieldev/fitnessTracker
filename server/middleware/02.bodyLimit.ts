import type { IncomingMessage } from 'node:http'
import type { H3Event } from 'h3'
import { logger } from '../utils/logger'
import { requestRoute } from '../utils/requestLog'
import { bodyLimitFor, declaredLengthTooLarge, PAYLOAD_METHODS } from '../utils/requestGuards/rules'

// h3's readRawBody reuses a body cached under this global symbol, so handlers read the capped copy.
const RAW_BODY = Symbol.for('h3RawBody')

type CachedRequest = IncomingMessage & { [RAW_BODY]?: Promise<Buffer> }

function tooLarge(limit: number) {
  return createError({ statusCode: 413, statusMessage: `Request body exceeds ${limit} bytes` })
}

function logTooLarge(event: H3Event, limit: number, declared: string | undefined, chunked: boolean) {
  const length = declared === undefined ? null : Number(declared)
  logger.warn(
    { route: requestRoute(event), limit, declared: Number.isFinite(length) ? length : null, chunked },
    'request body over the size limit'
  )
}

function readCapped(req: CachedRequest, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const onData = (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        req.off('data', onData).off('end', onEnd)
        // Drain the rest unbuffered so the 413 can still be written back.
        req.resume()
        reject(tooLarge(limit))
        return
      }
      chunks.push(chunk)
    }
    const onEnd = () => resolve(Buffer.concat(chunks))
    req.on('data', onData).on('end', onEnd).once('error', reject)
  })
}

export default defineEventHandler(async (event) => {
  if (!PAYLOAD_METHODS.has(event.method)) return
  const limit = bodyLimitFor(event.path)
  // Transfer-Encoding overrides Content-Length (RFC 9112 6.3), so a small declared length must not skip the stream cap.
  if (!/\bchunked\b/i.test(getRequestHeader(event, 'transfer-encoding') ?? '')) {
    const declared = getRequestHeader(event, 'content-length')
    if (declared !== undefined && declaredLengthTooLarge(declared, limit)) {
      logTooLarge(event, limit, declared, false)
      setResponseHeader(event, 'Connection', 'close')
      throw tooLarge(limit)
    }
    return
  }
  const req = event.node.req as CachedRequest
  const body = readCapped(req, limit)
  req[RAW_BODY] = body
  try {
    await body
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 413) logTooLarge(event, limit, undefined, true)
    setResponseHeader(event, 'Connection', 'close')
    throw error
  }
})
