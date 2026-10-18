import { logger } from '../utils/logger'
import { requestHost } from '../utils/proxy'
import { requestRoute } from '../utils/requestLog'
import { csrfRejection } from '../utils/requestGuards/rules'

function hostOf(origin: string | undefined): string | null {
  if (origin === undefined) return null
  try {
    return new URL(origin).host || null
  } catch {
    return null
  }
}

export default defineEventHandler((event) => {
  const origin = getRequestHeader(event, 'origin')
  const host = requestHost(event)
  const secFetchSite = getRequestHeader(event, 'sec-fetch-site')
  const reason = csrfRejection({
    method: event.method,
    path: event.path,
    authorization: getRequestHeader(event, 'authorization'),
    secFetchSite,
    origin,
    host
  })
  if (reason) {
    logger.warn(
      { reason, method: event.method, route: requestRoute(event), secFetchSite, originHost: hostOf(origin), host },
      'cross-site request blocked'
    )
    throw createError({ statusCode: 403, statusMessage: `Cross-site request blocked: ${reason}` })
  }
})
