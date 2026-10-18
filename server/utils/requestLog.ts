import type { H3Event } from 'h3'

const WARN_STATUSES = new Set([401, 403, 413, 429])

// The router matches inside the handler, so this is the low-cardinality pattern (/api/users/:id) only after it ran.
export function requestRoute(event: H3Event): string {
  return event.context.matchedRoute?.path ?? event.path.split('?')[0] ?? event.path
}

export function requestLogLevel(status: number, route?: string): 'error' | 'warn' | 'debug' {
  // Inngest answers a run that will be retried with a 500; the run-logging middleware logs the failure itself.
  if (status >= 500) return route === '/api/inngest' ? 'warn' : 'error'
  return WARN_STATUSES.has(status) ? 'warn' : 'debug'
}
