import { and, eq, isNull } from 'drizzle-orm'
import { recipes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { keyNutrients } from '~~/shared/utils/nutritionKeyed'
import { computeRecipeNutrition, loadRecipe } from '~~/server/utils/nutrition/recipeTotals'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  const rows = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      servings: recipes.servings,
      servingName: recipes.servingName,
      finishedWeightG: recipes.finishedWeightG,
      notes: recipes.notes
    })
    .from(recipes)
    .where(and(eq(recipes.userId, userId), isNull(recipes.deletedAt)))

  const { nutrientCatalog } = await import('~~/server/utils/nutrition/nutrientIds')
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))

  return Promise.all(
    rows.map(async (row) => {
      const recipe = await loadRecipe(db, userId, row.id)
      const nutrition = recipe ? await computeRecipeNutrition(db, userId, recipe) : null
      return {
        ...row,
        servings: Number(row.servings),
        finishedWeightG: row.finishedWeightG === null ? null : Number(row.finishedWeightG),
        perServing: nutrition ? keyNutrients(nutrition.perServing, idToKey) : {},
        broken: nutrition ? nutrition.brokenIngredients.length > 0 : true
      }
    })
  )
})
