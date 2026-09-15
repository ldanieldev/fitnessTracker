import { and, eq } from 'drizzle-orm'
import { foodUsageStats } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = Number(getRouterParam(event, 'id'))

  const [row] = await db
    .update(foodUsageStats)
    .set({ hiddenAt: new Date() })
    .where(and(eq(foodUsageStats.userId, userId), eq(foodUsageStats.foodId, foodId)))
    .returning({ userId: foodUsageStats.userId })

  if (!row) throw createError({ statusCode: 404, statusMessage: 'No usage to hide' })

  return { ok: true }
})
