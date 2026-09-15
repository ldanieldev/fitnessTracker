import { eq } from 'drizzle-orm'
import { recipeIngredients, recipes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { loadRecipe } from '~~/server/utils/nutrition/recipeTotals'
import { type PreparedIngredient, recipeSchema, resolveIngredientGrams } from '~~/server/utils/nutrition/recipeInput'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe ID' })
  }

  const existing = await loadRecipe(db, userId, id)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })

  const body = await parseBody(event, recipeSchema)

  const prepared: PreparedIngredient[] = []
  for (const ingredient of body.ingredients) {
    const food = await loadFood(db, userId, ingredient.foodId)
    if (!food) throw createError({ statusCode: 404, statusMessage: `Food not found: ${ingredient.foodId}` })
    prepared.push(resolveIngredientGrams(food, ingredient))
  }

  return db.transaction(async (tx) => {
    await tx
      .update(recipes)
      .set({
        name: body.name,
        servings: String(body.servings),
        servingName: body.servingName,
        notes: body.notes ?? null
      })
      .where(eq(recipes.id, id))

    await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id))

    await tx.insert(recipeIngredients).values(
      prepared.map((ingredient, sortOrder) => ({
        recipeId: id,
        foodId: ingredient.foodId,
        foodServingId: ingredient.foodServingId,
        quantity: String(ingredient.quantity),
        unitLabel: ingredient.unitLabel,
        gramsResolved: ingredient.gramsResolved === null ? null : String(ingredient.gramsResolved),
        sortOrder
      }))
    )

    return { id }
  })
})
