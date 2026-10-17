import { db } from '~~/server/utils/db'
import { keyNutrients } from '~~/shared/utils/nutritionKeyed'
import { loadFoods } from '~~/server/utils/nutrition/loadFood'
import { computeRecipeNutrition, loadUserRecipes } from '~~/server/utils/nutrition/recipeTotals'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const recipes = await loadUserRecipes(db, userId)
  const foods = await loadFoods(
    db,
    userId,
    recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.foodId))
  )
  const { nutrientCatalog } = await import('~~/server/utils/nutrition/nutrientIds')
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))

  return Promise.all(
    recipes.map(async (recipe) => {
      const nutrition = await computeRecipeNutrition(db, userId, recipe, foods)
      return {
        id: recipe.id,
        name: recipe.name,
        servings: recipe.servings,
        servingName: recipe.servingName,
        finishedWeightG: recipe.finishedWeightG,
        notes: recipe.notes,
        perServing: keyNutrients(nutrition.perServing, idToKey),
        broken: nutrition.brokenIngredients.length > 0
      }
    })
  )
})
