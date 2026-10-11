import type { Consistency } from '~~/shared/types/dashboard'
import { loadConsistency } from '~~/server/utils/dashboard/consistency'
import { dashboardContext, parseTodayQuery } from '~~/server/utils/dashboard/context'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<Consistency | null> => {
  const userId = await requireUserId(event)
  const ctx = await dashboardContext(userId, parseTodayQuery(event))
  const consistency = ctx.modules.workouts ? await loadConsistency(ctx) : null
  if (!consistency) setResponseStatus(event, 204)
  return consistency
})
