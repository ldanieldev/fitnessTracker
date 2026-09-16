import { and, desc, eq, inArray } from 'drizzle-orm'
import type { MeasurementGoal } from '~~/shared/types/body'
import { measurementGoals, measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export function toGoal(row: typeof measurementGoals.$inferSelect): MeasurementGoal {
  return {
    typeId: row.typeId,
    targetValue: Number(row.targetValue),
    targetDate: row.targetDate,
    startValue: Number(row.startValue),
    startDate: row.startDate
  }
}

export async function loadGoal(userId: number, typeId: number): Promise<MeasurementGoal | null> {
  const row = await db
    .select()
    .from(measurementGoals)
    .where(and(eq(measurementGoals.userId, userId), eq(measurementGoals.typeId, typeId)))
    .then((r) => r[0])
  return row ? toGoal(row) : null
}

export async function loadGoals(userId: number, typeIds: number[]): Promise<Map<number, MeasurementGoal>> {
  if (typeIds.length === 0) return new Map()
  const rows = await db
    .select()
    .from(measurementGoals)
    .where(and(eq(measurementGoals.userId, userId), inArray(measurementGoals.typeId, typeIds)))
  return new Map(rows.map((r) => [r.typeId, toGoal(r)]))
}

export async function latestReading(userId: number, typeId: number) {
  return db
    .select()
    .from(measurements)
    .where(and(eq(measurements.userId, userId), eq(measurements.typeId, typeId)))
    .orderBy(desc(measurements.measuredOn), desc(measurements.measuredAt), desc(measurements.id))
    .limit(1)
    .then((r) => r[0] ?? null)
}
