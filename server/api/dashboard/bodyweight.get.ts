import type { BodyweightTrend } from '~~/shared/types/dashboard'
import { loadBodyweight } from '~~/server/utils/dashboard/bodyweight'
import { dashboardContext, parseTodayQuery } from '~~/server/utils/dashboard/context'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<BodyweightTrend | null> => {
  const userId = await requireUserId(event)
  const ctx = await dashboardContext(userId, parseTodayQuery(event))
  const trend = ctx.modules.body ? await loadBodyweight(ctx) : null
  if (!trend) setResponseStatus(event, 204)
  return trend
})
