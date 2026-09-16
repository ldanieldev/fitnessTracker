import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { MetricOverview, SeriesPoint } from '~~/shared/types/body'
import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { toEntry } from '~~/server/utils/body/entries'
import { loadGoals } from '~~/server/utils/body/goals'
import { listTypesForUser } from '~~/server/utils/body/types'
import { requireUserId } from '~~/server/utils/session'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'

const SPARKLINE_DAYS = 90

export default defineEventHandler(async (event): Promise<MetricOverview[]> => {
  const userId = await requireUserId(event)
  const types = await listTypesForUser(userId)
  if (types.length === 0) return []
  const typeIds = types.map((t) => t.id)
  const goals = await loadGoals(userId, typeIds)
  const today = todayDate()
  const sparkFrom = shiftDate(today, -(SPARKLINE_DAYS - 1))

  // One query for the two newest readings per type; window functions beat N small queries once a user has many types.
  const ranked = db.$with('ranked').as(
    db
      .select({
        id: measurements.id,
        userId: measurements.userId,
        typeId: measurements.typeId,
        value: measurements.value,
        measuredAt: measurements.measuredAt,
        measuredOn: measurements.measuredOn,
        createdAt: measurements.createdAt,
        updatedAt: measurements.updatedAt,
        // id breaks same-minute measuredAt ties deterministically.
        rn: sql<number>`row_number() over (partition by ${measurements.typeId} order by ${measurements.measuredOn} desc, ${measurements.measuredAt} desc, ${measurements.id} desc)`.as('rn')
      })
      .from(measurements)
      .where(and(eq(measurements.userId, userId), inArray(measurements.typeId, typeIds)))
  )
  const recent = await db.with(ranked).select().from(ranked).where(lte(ranked.rn, 2))

  const sparkRows = await db
    .selectDistinctOn([measurements.typeId, measurements.measuredOn], {
      typeId: measurements.typeId,
      date: measurements.measuredOn,
      value: measurements.value
    })
    .from(measurements)
    .where(
      and(
        eq(measurements.userId, userId),
        inArray(measurements.typeId, typeIds),
        gte(measurements.measuredOn, sparkFrom),
        lte(measurements.measuredOn, today)
      )
    )
    .orderBy(measurements.typeId, measurements.measuredOn, sql`${measurements.measuredAt} desc`, desc(measurements.id))

  const sparkByType = new Map<number, SeriesPoint[]>()
  for (const r of sparkRows) {
    const list = sparkByType.get(r.typeId) ?? []
    list.push({ date: r.date, value: Number(r.value) })
    sparkByType.set(r.typeId, list)
  }

  return types.map((type) => {
    const rows = recent.filter((r) => r.typeId === type.id).sort((a, b) => Number(a.rn) - Number(b.rn))
    return {
      type,
      latest: rows[0] ? toEntry(rows[0]) : null,
      previous: rows[1] ? toEntry(rows[1]) : null,
      goal: goals.get(type.id) ?? null,
      sparkline: sparkByType.get(type.id) ?? []
    }
  })
})
