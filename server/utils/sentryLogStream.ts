import * as Sentry from '@sentry/nuxt'

const SENTRY_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
type SentryLevel = typeof SENTRY_LEVELS[number]

// pino writes numeric levels unless a formatter maps them; logger.ts maps them to names, so accept
// both rather than couple this module to that choice.
const LEVEL_BY_NUMBER: Record<number, SentryLevel> = {
  10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal'
}

export function toSentryLevel(level: unknown): SentryLevel {
  if (typeof level === 'number') return LEVEL_BY_NUMBER[level] ?? 'info'
  if (typeof level === 'string' && (SENTRY_LEVELS as readonly string[]).includes(level)) return level as SentryLevel
  return 'info'
}

/**
 * Splits one pino JSON line into a Sentry log, plus a Sentry issue when it carries an error.
 * `time`/`level`/`msg` are dropped from the attributes because Sentry models them itself.
 */
export function forwardLine(line: string) {
  let record: Record<string, unknown>
  try {
    record = JSON.parse(line)
  } catch {
    return
  }

  const { level, msg, time, err, ...attributes } = record
  const sentryLevel = toSentryLevel(level)

  Sentry.logger[sentryLevel](typeof msg === 'string' ? msg : '[non-string]', attributes)

  // Logging an error and handling it means Sentry's automatic capture never sees it, so a
  // caught-and-logged failure would otherwise exist only as a log line.
  if (err && (sentryLevel === 'error' || sentryLevel === 'fatal')) {
    Sentry.captureException(toError(err, msg), { level: sentryLevel, extra: attributes })
  }
}

function toError(err: unknown, msg: unknown): Error {
  if (err instanceof Error) return err
  // pino's std error serializer flattens Error to a plain object before this stream sees it.
  const { type, message, stack } = (err ?? {}) as Record<string, unknown>
  const reconstructed = new Error(
    typeof message === 'string' ? message : typeof msg === 'string' ? msg : 'unknown error'
  )
  if (typeof type === 'string') reconstructed.name = type
  if (typeof stack === 'string') reconstructed.stack = stack
  return reconstructed
}

/** A pino destination: one JSON line in, one Sentry log out. */
export const sentryLogStream = { write: forwardLine }
