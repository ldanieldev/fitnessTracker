import { and, eq } from 'drizzle-orm'
import type { MeasurementEntry } from '~~/shared/types/body'
import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export type MeasurementRow = typeof measurements.$inferSelect

export function toEntry(row: MeasurementRow): MeasurementEntry {
  return { id: row.id, typeId: row.typeId, value: Number(row.value), measuredAt: row.measuredAt.toISOString(), measuredOn: row.measuredOn }
}

export async function loadEntryForUser(userId: number, entryId: number): Promise<MeasurementRow> {
  const row = await db
    .select()
    .from(measurements)
    .where(and(eq(measurements.id, entryId), eq(measurements.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Measurement not found' })
  return row
}
