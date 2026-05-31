import { createRequire } from 'node:module'
import pino from 'pino'
import { trace, isSpanContextValid } from '@opentelemetry/api'

/**
 * Injects the active span's IDs into every log record. Returns {} when no span is active,
 * or when the context is invalid (all-zero) — which is what the no-op tracer yields
 * while OTel is disabled (ENABLE_OPENTELEMETRY!=true), so we don't stamp bogus
 * trace IDs into logs.
 */
export function traceContextMixin() {
  const span = trace.getActiveSpan()
  if (!span) return {}
  const ctx = span.spanContext()
  if (!isSpanContextValid(ctx)) return {}
  return { trace_id: ctx.traceId, span_id: ctx.spanId }
}

// JSON to logs/app.log (tailed by Alloy). In dev, also pretty-print to stdout.
// Both streams are in-process (pino.multistream) — no worker threads, which
// keeps this Bun-safe. NOTE: each multistream entry has its OWN level that
// defaults to 'info' regardless of the logger's level, so we stamp `level` on
// every stream — otherwise LOG_LEVEL=debug would be silently dropped here.
const level = (process.env.LOG_LEVEL || 'info') as pino.Level

const streams: pino.StreamEntry[] = [
  { level, stream: pino.destination({ dest: 'logs/app.log', mkdir: true, sync: false }) }
]
if (process.env.NODE_ENV !== 'production') {
  // pino-pretty is a CJS devDependency. Load it via createRequire so this
  // resolves in Nitro's pure-ESM runtime (bare `require` is undefined there)
  // while staying behind the dev guard so it's absent in production builds.
  const pretty = createRequire(import.meta.url)('pino-pretty')
  streams.push({ level, stream: pretty({ colorize: true }) })
}

export const logger = pino(
  {
    level,
    mixin: traceContextMixin,
    // Emit the level as a string ("info") not a number (30) so Loki's
    // stage.json level extraction yields readable values.
    formatters: { level: (label) => ({ level: label }) }
  },
  pino.multistream(streams)
)
