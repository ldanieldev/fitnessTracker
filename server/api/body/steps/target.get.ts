import type { StepTarget } from '~~/shared/types/steps'
import { stepTargetQuerySchema } from '~~/server/utils/body/input'
import { loadStepTargets } from '~~/server/utils/body/steps'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { stepTargetOn } from '~~/shared/utils/steps'

export default defineEventHandler(async (event): Promise<{ target: StepTarget | null }> => {
  const userId = await requireUserId(event)
  const query = parseQuery(event, stepTargetQuerySchema)
  return { target: stepTargetOn(await loadStepTargets(userId), query.to ?? todayDate()) }
})
