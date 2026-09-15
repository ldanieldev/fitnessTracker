import { z } from 'zod'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { loadIntakeRange, parseIntakeRangeQuery } from '~~/server/utils/nutrition/summary'
import { requireUserId } from '~~/server/utils/session'
import { rollingAverage } from '~~/shared/utils/nutritionSummary'

const windowQuerySchema = z.object({ window: z.coerce.number().int().min(1).max(90).default(7) })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = getQuery(event)

  const { from, to, dates } = parseIntakeRangeQuery(query)

  const { window } = parseWith(windowQuerySchema, query)

  const { nutrients, days } = await loadIntakeRange(userId, from, to, dates)

  const rollingByKey = new Map(
    nutrients.map((n) => [n.key, rollingAverage(days.map((d) => d.totals[n.key] ?? null), window)])
  )

  return {
    window,
    nutrients,
    days: days.map((day, i) => ({
      date: day.date,
      logged: day.logged,
      totals: day.totals,
      targets: day.targets,
      rolling: Object.fromEntries(nutrients.map((n) => [n.key, rollingByKey.get(n.key)![i]]))
    }))
  }
})
