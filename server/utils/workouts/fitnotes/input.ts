import { z } from 'zod'
import { boundedRecord, zId } from '~~/server/utils/validation'
import { FITNOTES_LIMITS } from '~~/shared/utils/fitnotes'

export const FITNOTES_MAX_BYTES = 5 * 1024 * 1024

export const fitNotesPreviewSchema = z.object({ csv: z.string().min(1).max(FITNOTES_MAX_BYTES) })

export const fitNotesImportSchema = fitNotesPreviewSchema.extend({
  mapping: boundedRecord(zId.nullable(), FITNOTES_LIMITS.exercises, FITNOTES_LIMITS.exerciseName).default({}),
  skipExistingDays: z.boolean().default(true)
})

export type FitNotesImportPayload = z.infer<typeof fitNotesImportSchema>
