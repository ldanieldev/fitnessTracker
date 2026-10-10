import type { StepDay } from '~~/shared/types/steps'
import { stepDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { stepDayPutSchema } from '~~/server/utils/body/input'
import { parseStepDate } from '~~/server/utils/body/steps'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<StepDay> => {
  const userId = await requireUserId(event)
  const day = parseStepDate(getRouterParam(event, 'date'))
  const { steps } = await parseBody(event, stepDayPutSchema)
  const row = await db
    .insert(stepDays)
    .values({ userId, day, steps, source: 'manual' })
    .onConflictDoUpdate({
      target: [stepDays.userId, stepDays.day],
      set: { steps, source: 'manual', updatedAt: new Date() }
    })
    .returning()
    .then((r) => r[0]!)
  return { date: row.day, steps: row.steps }
})
