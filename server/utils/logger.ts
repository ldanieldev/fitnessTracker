import { createRequire } from 'node:module'
import { accessSync, constants, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { hostname } from 'node:os'
import pino from 'pino'
import { trace, isSpanContextValid } from '@opentelemetry/api'
import { redactQueryParams } from './redactQueryParams'
import { sentryLogStream } from './sentryLogStream'

/** Injects the active span's IDs into every log record; {} when no span is active or the context is all-zero. */
export function traceContextMixin() {
  const span = trace.getActiveSpan()
  if (!span) return {}
  const ctx = span.spanContext()
  if (!isSpanContextValid(ctx)) return {}
  return { trace_id: ctx.traceId, span_id: ctx.spanId }
}

// NOTE: each multistream entry has its OWN level (default 'info'); stamp `level` on each or LOG_LEVEL=debug is lost.
const level = (process.env.LOG_LEVEL || 'info') as pino.Level
const isProduction = process.env.NODE_ENV === 'production'

const fileDest = process.env.LOG_FILE ?? 'logs/app.log'

// Probed synchronously: an async destination reports an unwritable dest as an uncaughtException rather than throwing.
function createFileStream(dest: string) {
  if (!dest) return undefined
  try {
    mkdirSync(dirname(dest), { recursive: true })
    accessSync(dirname(dest), constants.W_OK)
    return pino.destination({ dest, mkdir: true, sync: false })
  } catch {
    // Container WORKDIR is not writable by USER bun; stdout below still carries every line.
    return undefined
  }
}

export function sentryStreamLevel(logLevel: string, sentryLevel: string | undefined): pino.Level {
  const values = pino.levels.values
  const floor = sentryLevel && sentryLevel in values ? (sentryLevel as pino.Level) : 'warn'
  return (values[logLevel] ?? 0) > values[floor]! ? (logLevel as pino.Level) : floor
}

const streams: pino.StreamEntry[] = []

// Additive, never the only sink, so an unwritable path degrades instead of losing logs.
const fileStream = createFileStream(fileDest)
export const fileSinkActive = fileStream !== undefined
if (fileStream) streams.push({ level, stream: fileStream })

if (isProduction) {
  streams.push({ level, stream: process.stdout })
} else {
  // pino-pretty is a CJS devDependency loaded via createRequire because Nitro's runtime is pure ESM.
  const pretty = createRequire(import.meta.url)('pino-pretty')
  streams.push({ level, stream: pretty({ colorize: true }) })
}

if (process.env.SENTRY_DSN) {
  streams.push({ level: sentryStreamLevel(level, process.env.SENTRY_LOG_LEVEL), stream: sentryLogStream })
}

export const REDACT_PATHS = [
  'err.query',
  'err.params',
  'err.cause.query',
  'err.cause.params',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'secret',
  'email',
  'ip',
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.access_token',
  '*.refresh_token',
  '*.secret',
  '*.email',
  '*.ip',
  // No '*.code': it would also censor err.code (ECONNREFUSED, SQLSTATE), and pino's censor callback can't see the key.
  'code',
  'query.code',
  'req.headers.authorization',
  'req.headers.cookie'
]

// h3 errors carry `data`, which nuxt-auth-utils fills with the OAuth callback query or token response.
function withoutData(out: Record<string, unknown>) {
  delete out.data
  if (out.cause && typeof out.cause === 'object') withoutData(out.cause as Record<string, unknown>)
}

function serializeErr(err: unknown) {
  const out = pino.stdSerializers.err(err as Error)
  if (out && typeof out === 'object') {
    out.message = redactQueryParams(out.message)
    out.stack = redactQueryParams(out.stack)
    withoutData(out as unknown as Record<string, unknown>)
  }
  return out
}

export const redaction = {
  redact: REDACT_PATHS,
  serializers: { err: serializeErr }
} satisfies pino.LoggerOptions

export const logger = pino(
  {
    ...redaction,
    level,
    mixin: traceContextMixin,
    // Identity in the line, not just Alloy's static label, so a stdout/docker collector can label the stream.
    base: {
      pid: process.pid,
      hostname: hostname(),
      service: process.env.OTEL_SERVICE_NAME || 'my-fitness-journal-server',
      env: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.GIT_SHA || 'dev'
    },
    // Level as a string ("info") not a number (30) so Loki's stage.json extraction yields readable values.
    formatters: { level: (label) => ({ level: label }) }
  },
  pino.multistream(streams)
)

if (fileDest && !fileSinkActive) logger.warn({ dest: fileDest }, 'log file sink unavailable; logging to stdout only')
