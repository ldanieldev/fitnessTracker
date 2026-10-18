import { Middleware } from 'inngest'
import { logger } from '../logger'
import { wasReported } from './reported'

const log = logger.child({ component: 'inngest' })

const OUTBOX_DRAINS = new Set(['search-outbox-drain', 'exercise-search-outbox-drain'])
const MAX_OUTPUT_FIELDS = 16
// Outputs are counts, booleans and enum outcomes; free-text strings (error messages, file names) never pass.
const ENUM_STRING = /^[a-z_]{1,32}$/

type Scalar = number | boolean | string

function scalar(value: unknown): Scalar | undefined {
  if (typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'string' && ENUM_STRING.test(value)) return value
  return undefined
}

function scalars(value: object): Record<string, Scalar> {
  const out: Record<string, Scalar> = {}
  for (const [key, field] of Object.entries(value).slice(0, MAX_OUTPUT_FIELDS)) {
    const s = scalar(field)
    if (s !== undefined) out[key] = s
  }
  return out
}

export function outputSummary(output: unknown): Record<string, unknown> {
  const single = scalar(output)
  if (single !== undefined) return { result: single }
  if (!output || typeof output !== 'object' || Array.isArray(output)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(output).slice(0, MAX_OUTPUT_FIELDS)) {
    const s = scalar(value)
    if (s !== undefined) out[key] = s
    else if (Array.isArray(value)) out[key] = value.length
    else if (value && typeof value === 'object') out[key] = scalars(value)
  }
  return out
}

function drainDidWork(output: unknown): boolean {
  if (!output || typeof output !== 'object') return false
  const o = output as { processed?: unknown; failed?: unknown; rebuilt?: unknown }
  return Number(o.processed) > 0 || Number(o.failed) > 0 || o.rebuilt === true
}

interface RunCtx {
  runId: string
  attempt: number
  event?: { data?: Record<string, unknown> }
}

function runFields(ctx: RunCtx, fn: { opts: { id: string } }) {
  const data = ctx.event?.data
  const fields: Record<string, unknown> = { fnId: fn.opts.id, runId: ctx.runId, attempt: ctx.attempt }
  if (typeof data?.userId === 'number') fields.userId = data.userId
  if (typeof data?.jobId === 'number') fields.jobId = data.jobId
  return fields
}

export class RunLogging extends Middleware.BaseMiddleware {
  readonly id = 'run-logging'

  override onRunStart({ ctx, fn }: Middleware.OnRunStartArgs) {
    log.debug(runFields(ctx, fn), 'Inngest run started')
  }

  override onRunComplete({ ctx, fn, output }: Middleware.OnRunCompleteArgs) {
    const quiet = OUTBOX_DRAINS.has(fn.opts.id) && !drainDidWork(output)
    log[quiet ? 'debug' : 'info']({ ...outputSummary(output), ...runFields(ctx, fn) }, 'Inngest run completed')
  }

  override onRunError({ ctx, fn, error, isFinalAttempt }: Middleware.OnRunErrorArgs) {
    const fields = { err: error, ...runFields(ctx, fn) }
    if (!isFinalAttempt) return log.warn(fields, 'Inngest run failed; retrying')
    // A StepError wraps a step failure that onStepError already logged at error.
    const captured = wasReported(error) || error.name === 'StepError'
    log.error(captured ? { ...fields, sentryCaptured: true } : fields, 'Inngest run failed')
  }

  override onStepError({ ctx, fn, error, isFinalAttempt, stepInfo }: Middleware.OnStepErrorArgs) {
    const fields = { err: error, stepId: stepInfo.options.id, ...runFields(ctx, fn) }
    if (!isFinalAttempt) return log.warn(fields, 'Inngest step failed; retrying')
    log.error(wasReported(error) ? { ...fields, sentryCaptured: true } : fields, 'Inngest step failed')
  }
}
