import { and, eq, isNull, or } from 'drizzle-orm'
import type { MeasurementType } from '~~/shared/types/body'
import { measurementTypePrefs, measurementTypes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export type MeasurementTypeRow = typeof measurementTypes.$inferSelect

export function toMeasurementType(row: MeasurementTypeRow, pref?: { hidden: boolean, sortOrder: number | null }): MeasurementType {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    unit: row.unit,
    precision: row.precision,
    direction: row.direction,
    builtIn: row.userId === null,
    hidden: pref?.hidden ?? false,
    sortOrder: pref?.sortOrder ?? null
  }
}

export function compareTypes(a: MeasurementType, b: MeasurementType): number {
  if (a.sortOrder !== null || b.sortOrder !== null) {
    if (a.sortOrder === null) return 1
    if (b.sortOrder === null) return -1
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  }
  if (a.builtIn !== b.builtIn) return a.builtIn ? -1 : 1
  return a.id - b.id
}

function visibleTo(userId: number) {
  return and(isNull(measurementTypes.deletedAt), or(isNull(measurementTypes.userId), eq(measurementTypes.userId, userId)))
}

export async function listTypesForUser(userId: number, opts: { includeHidden?: boolean } = {}): Promise<MeasurementType[]> {
  const rows = await db
    .select({ type: measurementTypes, hidden: measurementTypePrefs.hidden, sortOrder: measurementTypePrefs.sortOrder })
    .from(measurementTypes)
    .leftJoin(
      measurementTypePrefs,
      and(eq(measurementTypePrefs.typeId, measurementTypes.id), eq(measurementTypePrefs.userId, userId))
    )
    .where(visibleTo(userId))

  return rows
    .map((r) => toMeasurementType(r.type, r.hidden === null ? undefined : { hidden: r.hidden, sortOrder: r.sortOrder }))
    .filter((t) => opts.includeHidden || !t.hidden)
    .sort(compareTypes)
}

export async function loadTypeForUser(userId: number, typeId: number): Promise<MeasurementTypeRow> {
  const row = await db
    .select()
    .from(measurementTypes)
    .where(and(eq(measurementTypes.id, typeId), visibleTo(userId)))
    .then((r) => r[0])
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Measurement type not found' })
  return row
}
