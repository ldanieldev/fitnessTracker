import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { measurements } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { toEntry } from '~~/server/utils/body/entries'
import { rangeQuerySchema } from '~~/server/utils/body/input'
import { loadTypeForUser } from '~~/server/utils/body/types'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const typeId = Number(getRouterParam(event, 'id'))
  const query = parseQuery(event, rangeQuerySchema)
  await loadTypeForUser(userId, typeId)
  const to = query.to ?? todayDate()

  const rows = await db
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.userId, userId),
        eq(measurements.typeId, typeId),
        query.from ? gte(measurements.measuredOn, query.from) : undefined,
        lte(measurements.measuredOn, to)
      )
    )
    .orderBy(desc(measurements.measuredOn), desc(measurements.measuredAt), desc(measurements.id)) // id breaks same-minute measuredAt ties deterministically

  return rows.map(toEntry)
})
