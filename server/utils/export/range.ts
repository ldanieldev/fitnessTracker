import { z } from 'zod'
import { isoDate } from '~~/server/utils/body/input'

export type ExportRange = { from?: string; to?: string }

export const exportQuerySchema = z
  .object({ today: isoDate.optional(), from: isoDate.optional(), to: isoDate.optional() })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'from must be on or before to', path: ['from'] })

export function exportFilename(date: string, range: ExportRange) {
  const suffix = range.from || range.to ? `-${range.from ?? 'start'}_${range.to ?? date}` : ''
  return `my-fitness-journal-${date}${suffix}.json`
}
