import { and, desc, eq, isNull } from 'drizzle-orm'
import type { MeasurementDirection } from '~~/shared/types/body'
import type { BodyweightTrend } from '~~/shared/types/dashboard'
import { measurements, measurementTypes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadGoal } from '~~/server/utils/body/goals'
import { dailySeries } from '~~/server/utils/body/series'
import { cachedPart } from '~~/server/utils/dashboard/cache'
import type { DashboardContext } from '~~/server/utils/dashboard/context'
import { bodyweightStamp } from '~~/server/utils/dashboard/stamps'
import { bodyweightStats, CALENDAR_WEEKS } from '~~/shared/utils/dashboard'
import { shiftDate } from '~~/shared/utils/nutritionSummary'
import { weekStartOf } from '~~/shared/utils/programs'

async function bodyweightType() {
  return db
    .select({
      id: measurementTypes.id,
      unit: measurementTypes.unit,
      precision: measurementTypes.precision,
      direction: measurementTypes.direction
    })
    .from(measurementTypes)
    .where(and(eq(measurementTypes.key, 'bodyweight'), isNull(measurementTypes.userId)))
    .then((r) => r[0] ?? null)
}

// Same order as the body overview, so the daily change matches the Body page delta.
async function lastTwoReadings(userId: number, typeId: number) {
  const rows = await db
    .select({ value: measurements.value, date: measurements.measuredOn })
    .from(measurements)
    .where(and(eq(measurements.userId, userId), eq(measurements.typeId, typeId)))
    .orderBy(desc(measurements.measuredOn), desc(measurements.measuredAt), desc(measurements.id))
    .limit(2)
  return rows.map((r) => ({ value: Number(r.value), date: r.date }))
}

export async function loadBodyweight(ctx: DashboardContext): Promise<BodyweightTrend | null> {
  const type = await bodyweightType()
  if (!type) return null
  // The oldest of the 12 completed weeks; the 4-weeks-back comparison falls inside them.
  const from = shiftDate(weekStartOf(ctx.today, ctx.weekStart), -7 * CALENDAR_WEEKS)
  return cachedPart('bodyweight', ctx, () => bodyweightStamp(ctx.userId, type.id), async () => {
    const [points, [latest, previous], goal] = await Promise.all([
      dailySeries(ctx.userId, type.id, from, ctx.today),
      lastTwoReadings(ctx.userId, type.id),
      loadGoal(ctx.userId, type.id)
    ])
    const stats = bodyweightStats(points, ctx.today, ctx.weekStart)
    return {
      typeId: type.id,
      unit: type.unit,
      precision: type.precision,
      direction: type.direction as MeasurementDirection,
      ...stats,
      latest: latest ?? null,
      previous: previous ?? null,
      goal: goal ? { targetValue: goal.targetValue, startValue: goal.startValue } : null
    }
  })
}
