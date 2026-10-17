import { and, asc, between, eq } from 'drizzle-orm'
import { z } from 'zod'
import { diaryDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { calendarDateSchema } from '~~/server/utils/validation'
import { enumerateDates } from '~~/shared/utils/nutritionSummary'

const querySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { from, to } = parseQuery(event, querySchema)
  if (from > to || enumerateDates(from, to).length > 62) {
    throw createError({ statusCode: 400, statusMessage: 'Range must be 1–62 days' })
  }
  const rows = await db
    .select({ date: diaryDays.date })
    .from(diaryDays)
    .where(and(eq(diaryDays.userId, userId), between(diaryDays.date, from, to)))
    .orderBy(asc(diaryDays.date))
  return { dates: rows.map((r) => String(r.date)) }
})
