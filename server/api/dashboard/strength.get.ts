import type { Strength } from '~~/shared/types/dashboard'
import { loadStrength } from '~~/server/utils/dashboard/strength'
import { dashboardContext, parseTodayQuery } from '~~/server/utils/dashboard/context'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<Strength | null> => {
  const userId = await requireUserId(event)
  const ctx = await dashboardContext(userId, parseTodayQuery(event))
  const strength = ctx.modules.workouts ? await loadStrength(ctx) : null
  if (!strength) setResponseStatus(event, 204)
  return strength
})
