import type { NutritionStreak } from '~~/shared/types/dashboard'
import { dashboardContext, parseTodayQuery } from '~~/server/utils/dashboard/context'
import { loadNutrition } from '~~/server/utils/dashboard/nutrition'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<NutritionStreak | null> => {
  const userId = await requireUserId(event)
  const ctx = await dashboardContext(userId, parseTodayQuery(event))
  const streak = ctx.modules.nutrition ? await loadNutrition(ctx) : null
  if (!streak) setResponseStatus(event, 204)
  return streak
})
