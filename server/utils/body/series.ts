import { and, asc, desc, eq, gte, lte, min } from 'drizzle-orm'
import type { SeriesGranularity, SeriesPoint } from '~~/shared/types/body'
import { measurements, users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { bucketWeekly, DAILY_CAP_DAYS, daysBetween } from '~~/shared/utils/bodyMetrics'

export async function dailySeries(userId: number, typeId: number, from: string | null, to: string): Promise<SeriesPoint[]> {
  const rows = await db
    .selectDistinctOn([measurements.measuredOn], { date: measurements.measuredOn, value: measurements.value })
    .from(measurements)
    .where(
      and(
        eq(measurements.userId, userId),
        eq(measurements.typeId, typeId),
        from ? gte(measurements.measuredOn, from) : undefined,
        lte(measurements.measuredOn, to)
      )
    )
    .orderBy(asc(measurements.measuredOn), desc(measurements.measuredAt), desc(measurements.id)) // id breaks same-minute measuredAt ties deterministically
  return rows.map((r) => ({ date: r.date, value: Number(r.value) }))
}

export async function earliestDate(userId: number, typeId: number): Promise<string | null> {
  const row = await db
    .select({ first: min(measurements.measuredOn) })
    .from(measurements)
    .where(and(eq(measurements.userId, userId), eq(measurements.typeId, typeId)))
    .then((r) => r[0])
  return row?.first ?? null
}

export async function userWeekStart(userId: number): Promise<0 | 1> {
  const row = await db.select({ weekStart: users.weekStart }).from(users).where(eq(users.id, userId)).then((r) => r[0])
  return row?.weekStart === 0 ? 0 : 1
}

export async function seriesFor(userId: number, typeId: number, from: string | null, to: string, weekStart: 0 | 1) {
  const start = from ?? (await earliestDate(userId, typeId)) ?? to
  const daily = await dailySeries(userId, typeId, start, to)
  const granularity: SeriesGranularity = daysBetween(start, to) > DAILY_CAP_DAYS ? 'week' : 'day'
  return { granularity, from: start, to, points: granularity === 'week' ? bucketWeekly(daily, weekStart) : daily }
}
