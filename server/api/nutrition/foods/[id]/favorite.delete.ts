import { and, eq } from 'drizzle-orm'
import { foodFavorites } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = Number(getRouterParam(event, 'id'))

  await db.delete(foodFavorites).where(and(eq(foodFavorites.userId, userId), eq(foodFavorites.foodId, foodId)))

  return { ok: true }
})
