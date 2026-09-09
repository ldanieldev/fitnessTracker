import { foodFavorites } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = Number(getRouterParam(event, 'id'))

  const food = await loadFood(db, userId, foodId)
  if (!food) throw createError({ statusCode: 404, statusMessage: 'Food not found' })

  await db.insert(foodFavorites).values({ userId, foodId }).onConflictDoNothing()

  return { ok: true }
})
