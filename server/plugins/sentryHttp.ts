import * as Sentry from '@sentry/nuxt'
import type { H3Event } from 'h3'
import { isExpectedFailure } from '../utils/expectedFailure'
import { recordRequestDuration } from '../utils/metrics'
import { logger } from '../utils/logger'
import { requestLogLevel, requestRoute } from '../utils/requestLog'

/**
 * Wraps every request in an `http.server` root span and records its duration.
 *
 * Sentry cannot create the root span on its own here: it relies on
 * @opentelemetry/instrumentation-http patching `node:http` through import-in-the-middle, and that
 * does not fire under Bun (same failure mode as @opentelemetry/instrumentation-pg — see
 * server/utils/db.ts). This is load-bearing, not an optimization: without a root span,
 * `withQuerySpan`'s spans are orphan roots, and an orphan root created through the raw
 * OpenTelemetry API is dropped silently — measured, see
 * .claude/docs/2026-09-07-sentry-logs-lgtm-metrics-design.md.
 *
 * The duration metric is recorded here rather than from nitro's `afterResponse` hook because h3
 * only fires that hook on the success paths, so failed requests — the ones the error rate is
 * built from — would never be counted.
 */
const stripQuery = (path: string) => path.split('?')[0] ?? path

export default defineNitroPlugin((nitroApp) => {
  // h3App is a Nitro internal with no public type; shape is h3 v1 (pinned in package.json overrides).
  const app = (nitroApp as unknown as { h3App: { handler: (event: H3Event) => unknown } }).h3App
  const inner = app.handler

  app.handler = (event: H3Event) => {
    const method = event.method ?? 'UNKNOWN'
    return Sentry.startSpan(
      {
        name: `${method} ${stripQuery(event.path)}`,
        op: 'http.server',
        forceTransaction: true,
        attributes: { 'http.request.method': method }
      },
      async (span) => {
        const start = performance.now()
        let status = 500
        let expected = false
        try {
          const body = await inner(event)
          status = getResponseStatus(event)
          return body
        } catch (error) {
          // Nitro only stamps the response status from a thrown error after this wrapper returns,
          // so reading it off the event here would report the handler's last status instead.
          status = (error as { statusCode?: number }).statusCode ?? 500
          expected = isExpectedFailure(error)
          throw error
        } finally {
          const durationMs = performance.now() - start
          const route = requestRoute(event)
          span.updateName(`${method} ${route}`)
          span.setAttribute('http.route', route)
          span.setAttribute('http.response.status_code', status)
          recordRequestDuration(durationMs / 1000, {
            'http.route': route,
            'http.request.method': method,
            'http.response.status_code': status
          })
          const { userId, authVia, accessTokenId } = event.context
          logger[expected ? 'warn' : requestLogLevel(status, route)](
            { method, route, status, durationMs: Math.round(durationMs), userId, authVia, accessTokenId },
            'request'
          )
        }
      }
    )
  }
})
