import { z } from 'zod'
import { STEPS_MAX, STEP_WEEKS_MAX } from '~~/shared/utils/steps'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const isoDate = z
  .string()
  .regex(ISO_DATE, 'Date must be YYYY-MM-DD')
  .refine((raw) => {
    const parsed = new Date(`${raw}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
  }, 'Date must be a real calendar date')

const utcOffsetMinutes = z.number().int().min(-840).max(840).optional()

export const entryCreateSchema = z.object({
  typeId: z.number().int().positive(),
  value: z.number(),
  measuredAt: z.coerce.date().optional(),
  measuredOn: isoDate.optional(),
  utcOffsetMinutes
})

export const entryPatchSchema = z
  .object({
    value: z.number().optional(),
    measuredAt: z.coerce.date().optional(),
    measuredOn: isoDate.optional(),
    utcOffsetMinutes
  })
  .refine(
    (body) => [body.value, body.measuredAt, body.measuredOn].some((v) => v !== undefined),
    'Nothing to update'
  )

export const rangeQuerySchema = z.object({ from: isoDate.optional(), to: isoDate.optional() })

export const todayQuerySchema = z.object({ today: isoDate.optional() })

export const typeCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  unit: z.string().trim().min(1).max(16),
  precision: z.number().int().min(0).max(3),
  direction: z.enum(['lower', 'higher', 'neutral'])
})

export const typePatchSchema = typeCreateSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

export const prefsPutSchema = z.object({
  hidden: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional()
})

export const goalPutSchema = z.object({
  targetValue: z.number(),
  targetDate: isoDate.nullable().optional()
})

export const stepDayPutSchema = z.object({
  steps: z.number().int().min(0).max(STEPS_MAX),
  partial: z.boolean().default(false)
})

export const stepTargetPutSchema = z.object({
  dailyTarget: z.number().int().min(1).max(STEPS_MAX),
  effectiveFrom: isoDate
})

export const stepWeeksQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(STEP_WEEKS_MAX).default(1),
  to: isoDate.optional()
})

export const stepTargetQuerySchema = z.object({ to: isoDate.optional() })
