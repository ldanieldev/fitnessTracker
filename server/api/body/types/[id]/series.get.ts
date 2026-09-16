import { and, eq } from 'drizzle-orm'
import type { MetricSeries } from '~~/shared/types/body'
import { measurementTypePrefs } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { toEntry } from '~~/server/utils/body/entries'
import { latestReading, loadGoal } from '~~/server/utils/body/goals'
import { rangeQuerySchema } from '~~/server/utils/body/input'
import { seriesFor, userWeekStart } from '~~/server/utils/body/series'
import { loadTypeForUser, toMeasurementType } from '~~/server/utils/body/types'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export default defineEventHandler(async (event): Promise<MetricSeries> => {
  const userId = await requireUserId(event)
  const typeId = Number(getRouterParam(event, 'id'))
  const query = parseQuery(event, rangeQuerySchema)
  const typeRow = await loadTypeForUser(userId, typeId)
  const to = query.to ?? todayDate()
  if (query.from && query.from > to) throw createError({ statusCode: 400, statusMessage: 'from must be before to' })

  const pref = await db
    .select({ hidden: measurementTypePrefs.hidden, sortOrder: measurementTypePrefs.sortOrder })
    .from(measurementTypePrefs)
    .where(and(eq(measurementTypePrefs.userId, userId), eq(measurementTypePrefs.typeId, typeId)))
    .then((r) => r[0])
  const weekStart = await userWeekStart(userId)
  const [series, latest] = await Promise.all([seriesFor(userId, typeId, query.from ?? null, to, weekStart), latestReading(userId, typeId)])
  return { type: toMeasurementType(typeRow, pref), goal: await loadGoal(userId, typeId), latest: latest ? toEntry(latest) : null, ...series }
})
