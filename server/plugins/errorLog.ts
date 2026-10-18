import { H3Error } from 'h3'
import { isExpectedFailure } from '../utils/expectedFailure'
import { logger } from '../utils/logger'
import { requestRoute } from '../utils/requestLog'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (err, { event }) => {
    if ((err instanceof H3Error && err.statusCode < 500) || isExpectedFailure(err)) return
    logger.error(
      {
        err,
        method: event?.method,
        route: event ? requestRoute(event) : undefined,
        userId: event?.context.userId,
        // Sentry's own Nitro error hook already captured this, so the log stream must not open a second issue.
        sentryCaptured: true
      },
      'unhandled server error'
    )
  })
})
