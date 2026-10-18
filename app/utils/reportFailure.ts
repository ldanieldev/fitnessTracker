import * as Sentry from '@sentry/nuxt'

const statusOf = (err: unknown) => (err as { statusCode?: number } | null | undefined)?.statusCode

export function isReportable(err: unknown): boolean {
  const status = statusOf(err)
  return status === undefined || status >= 500
}

export function errorName(err: unknown): string {
  return err instanceof Error ? err.name : typeof err
}

// ofetch puts the request URL in the message, and its query string can carry search text.
const QUERY = /\?[^"\s]*/g

function scrubbed(err: unknown): Error {
  if (!(err instanceof Error)) {
    const clean = new Error('Non-Error thrown')
    clean.name = errorName(err)
    return clean
  }
  const message = err.message.replace(QUERY, '')
  const clean = new Error(message)
  clean.name = err.name
  if (err.stack) clean.stack = err.message ? err.stack.replace(err.message, message) : err.stack
  return clean
}

export function reportFailure(err: unknown, action: string): void {
  if (!isReportable(err)) return
  const status = statusOf(err)
  Sentry.captureException(scrubbed(err), {
    tags: status === undefined ? { action } : { action, status: String(status) }
  })
}
