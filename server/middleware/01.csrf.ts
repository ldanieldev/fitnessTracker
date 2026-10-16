import { requestHost } from '../utils/proxy'
import { csrfRejection } from '../utils/requestGuards/rules'

export default defineEventHandler((event) => {
  const reason = csrfRejection({
    method: event.method,
    path: event.path,
    authorization: getRequestHeader(event, 'authorization'),
    secFetchSite: getRequestHeader(event, 'sec-fetch-site'),
    origin: getRequestHeader(event, 'origin'),
    host: requestHost(event)
  })
  if (reason) throw createError({ statusCode: 403, statusMessage: `Cross-site request blocked: ${reason}` })
})
