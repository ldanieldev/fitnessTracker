import { z } from 'zod'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { loadIntakeRange, parseIntakeRangeQuery } from '~~/server/utils/nutrition/summary'
import { requireUserId } from '~~/server/utils/session'
import { toCsv } from '~~/shared/utils/nutritionExport'

const formatQuerySchema = z.object({ format: z.enum(['csv', 'json']).default('csv') })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = getQuery(event)

  const { from, to, dates } = parseIntakeRangeQuery(query)

  const { format } = parseWith(formatQuerySchema, query)

  const { nutrients, days } = await loadIntakeRange(userId, from, to, dates)

  if (format === 'json') {
    return { nutrients, days }
  }

  const csv = toCsv(
    days.map((day) => ({
      date: day.date,
      logged: day.logged,
      profileName: day.profileName,
      totals: day.logged ? (day.totals as Record<string, number>) : {},
      targets: day.logged ? day.targets : null
    })),
    nutrients.map((n) => n.key)
  )

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="intake-${from}-to-${to}.csv"`)
  return csv
})
