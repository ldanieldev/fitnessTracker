import { eq } from 'drizzle-orm'
import { recipes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadRecipe } from '~~/server/utils/nutrition/recipeTotals'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe ID' })
  }

  const recipe = await loadRecipe(db, userId, id)
  if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })

  await db.update(recipes).set({ deletedAt: new Date() }).where(eq(recipes.id, id))

  return { ok: true }
})
