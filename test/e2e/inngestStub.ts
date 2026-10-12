import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

// Keeps e2e events off the dev Inngest, which runs them on a live `bun dev` against the shared DB; GET /sent lists.
export default async function inngestStub() {
  const sent: unknown[] = []
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/sent') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(sent))
      return
    }
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      const events = [JSON.parse(body || '[]')].flat()
      sent.push(...events)
      const ids = events.map((_, i) => `stub-${sent.length - events.length + i}`)
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ids, status: 200 }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  process.env.INNGEST_EVENT_API_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
  return () => new Promise<void>((resolve) => server.close(() => resolve()))
}
