import { and, eq } from 'drizzle-orm'
import { foodFavorites } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = routeId(event)

  await db.delete(foodFavorites).where(and(eq(foodFavorites.userId, userId), eq(foodFavorites.foodId, foodId)))

  return { ok: true }
})
