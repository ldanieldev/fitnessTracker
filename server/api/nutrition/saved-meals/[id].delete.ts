import { eq } from 'drizzle-orm'
import { savedMeals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadSavedMeal } from '~~/server/utils/nutrition/savedMeal'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)

  const existing = await loadSavedMeal(db, userId, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Saved meal not found' })

  await db.update(savedMeals).set({ deletedAt: new Date() }).where(eq(savedMeals.id, id))

  return { ok: true }
})
