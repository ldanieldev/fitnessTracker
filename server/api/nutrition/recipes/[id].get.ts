import { db } from '~~/server/utils/db'
import { describeLines } from '~~/server/utils/nutrition/libraryLines'
import { keyNutrients } from '~~/shared/utils/nutritionKeyed'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { computeRecipeNutrition, loadRecipe } from '~~/server/utils/nutrition/recipeTotals'
import { requireUserId } from '~~/server/utils/session'

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
  const described = await describeLines(db, userId, recipe.ingredients)

  return {
    id: recipe.id,
    name: recipe.name,
    servings: recipe.servings,
    servingName: recipe.servingName,
    finishedWeightG: recipe.finishedWeightG,
    notes: recipe.notes,
    ingredients: described.lines,
    perServing: keyNutrients(nutrition.perServing, idToKey),
    total: keyNutrients(nutrition.total, idToKey),
    brokenIngredients: nutrition.brokenIngredients
  }
})
