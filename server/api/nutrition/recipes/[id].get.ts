import { db } from '~~/server/utils/db'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { computeRecipeNutrition, loadRecipe } from '~~/server/utils/nutrition/recipeTotals'
import { requireUserId } from '~~/server/utils/nutrition/session'

function byKey(amounts: Record<number, number>, idToKey: Map<number, string>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, amount] of Object.entries(amounts)) {
    const key = idToKey.get(Number(id))
    if (key) out[key] = amount
  }
  return out
}

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  if (Number.isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid recipe ID' })
  }

  const recipe = await loadRecipe(db, userId, id)
  if (!recipe) throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })

  const nutrition = await computeRecipeNutrition(db, userId, recipe)
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))

  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    servingName: recipe.servingName,
    finishedWeightG: recipe.finishedWeightG,
    notes: recipe.notes,
    ingredients: recipe.ingredients,
    perServing: byKey(nutrition.perServing, idToKey),
    total: byKey(nutrition.total, idToKey),
    brokenIngredients: nutrition.brokenIngredients
  }
})
