import type { StepWeek } from '~~/shared/types/steps'
import { stepWeeksQuerySchema } from '~~/server/utils/body/input'
import { userWeekStart } from '~~/server/utils/body/series'
import { loadStepWeeks } from '~~/server/utils/body/steps'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export default defineEventHandler(async (event): Promise<StepWeek[]> => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, stepWeeksQuerySchema)
  return loadStepWeeks(userId, await userWeekStart(userId), query.to ?? todayDate(), query.count)
})
