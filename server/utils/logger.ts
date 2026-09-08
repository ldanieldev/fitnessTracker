import { createRequire } from 'node:module'
import { accessSync, constants, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { hostname } from 'node:os'
import pino from 'pino'
import { trace, isSpanContextValid } from '@opentelemetry/api'
import { sentryLogStream } from './sentryLogStream'

/** Injects the active span's IDs into every log record; {} when no span is active or the context is all-zero. */
export function traceContextMixin() {
  const span = trace.getActiveSpan()
  if (!span) return {}
  const ctx = span.spanContext()
  if (!isSpanContextValid(ctx)) return {}
  return { trace_id: ctx.traceId, span_id: ctx.spanId }
}

// NOTE: each multistream entry has its OWN level defaulting to 'info', so stamp `level` on every one or LOG_LEVEL=debug is dropped here.
const level = (process.env.LOG_LEVEL || 'info') as pino.Level
const isProduction = process.env.NODE_ENV === 'production'

// Probed synchronously: an async destination reports an unwritable dest as an uncaughtException rather than throwing.
function createFileStream() {
  const dest = process.env.LOG_FILE ?? 'logs/app.log'
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

const streams: pino.StreamEntry[] = []

// Additive, never the only sink, so an unwritable path degrades instead of losing logs.
const fileStream = createFileStream()
if (fileStream) streams.push({ level, stream: fileStream })

if (isProduction) {
  streams.push({ level, stream: process.stdout })
} else {
  // pino-pretty is a CJS devDependency loaded via createRequire because Nitro's runtime is pure ESM.
  const pretty = createRequire(import.meta.url)('pino-pretty')
  streams.push({ level, stream: pretty({ colorize: true }) })
}

if (process.env.SENTRY_DSN) {
  streams.push({ level, stream: sentryLogStream })
}

export const logger = pino(
  {
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
