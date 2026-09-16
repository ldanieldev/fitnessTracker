import { z } from 'zod'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const isoDate = z
  .string()
  .regex(ISO_DATE, 'Date must be YYYY-MM-DD')
  .refine((raw) => {
    const parsed = new Date(`${raw}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw
  }, 'Date must be a real calendar date')

export const entryCreateSchema = z.object({
  typeId: z.number().int().positive(),
  value: z.number(),
  measuredAt: z.coerce.date().optional(),
  measuredOn: isoDate.optional()
})

export const entryPatchSchema = z
  .object({
    value: z.number().optional(),
    measuredAt: z.coerce.date().optional(),
    measuredOn: isoDate.optional()
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update')

export const rangeQuerySchema = z.object({ from: isoDate.optional(), to: isoDate.optional() })

export const typeCreateSchema = z.object({
  name: z.string().trim().min(1).max(64),
  unit: z.string().trim().min(1).max(16),
  precision: z.number().int().min(0).max(3),
  direction: z.enum(['lower', 'higher', 'neutral'])
})

export const typePatchSchema = typeCreateSchema.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to update')

export const prefsPutSchema = z.object({
  hidden: z.boolean().optional(),
  sortOrder: z.number().int().nullable().optional()
})

export const goalPutSchema = z.object({
  targetValue: z.number(),
  targetDate: isoDate.nullable().optional()
})
