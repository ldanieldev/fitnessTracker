import { z } from 'zod'

export const FITNOTES_MAX_BYTES = 5 * 1024 * 1024

export const fitNotesPreviewSchema = z.object({ csv: z.string().min(1).max(FITNOTES_MAX_BYTES) })

export const fitNotesImportSchema = fitNotesPreviewSchema.extend({
  mapping: z.record(z.string(), z.number().int().positive().nullable()).default({}),
  skipExistingDays: z.boolean().default(true)
})

export type FitNotesImportPayload = z.infer<typeof fitNotesImportSchema>
