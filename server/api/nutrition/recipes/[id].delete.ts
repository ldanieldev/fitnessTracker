import { eq } from 'drizzle-orm'
import { recipes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadRecipe } from '~~/server/utils/nutrition/recipeTotals'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)

  const recipe = await loadRecipe(db, userId, id)
  if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })

  await db.update(recipes).set({ deletedAt: new Date() }).where(eq(recipes.id, id))

  return { ok: true }
})
