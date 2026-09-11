import { and, asc, eq, isNull } from 'drizzle-orm'
import type { FoodForResolve, ResolveResult } from '~~/shared/types/nutrition'
import { recipeIngredients, recipes } from '~~/server/db/schema'
import { resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { normalizeUnitLabel } from '~~/shared/utils/nutritionUnits'
import { perServingNutrition, sumIngredients } from '~~/shared/utils/nutritionRecipe'
import type { DbClient } from '../db'
import { selectUnit } from './entry'
import { loadFood } from './loadFood'

export interface RecipeIngredientRow {
  id: number
  foodId: number
  foodServingId: number
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  sortOrder: number
}

export interface LoadedRecipe {
  id: number
  userId: number
  name: string
  servings: number
  servingName: string
  finishedWeightG: number | null
  notes: string | null
  ingredients: RecipeIngredientRow[]
}

export interface ResolvedIngredient {
  foodId: number
  name: string
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  nutrients: Record<number, number>
}

export interface RecipeNutrition {
  perServing: Record<number, number>
  total: Record<number, number>
  brokenIngredients: number[]
  ingredients: ResolvedIngredient[]
}

export async function loadRecipe(
  client: DbClient,
  userId: number,
  recipeId: number
): Promise<LoadedRecipe | null> {
  const head = await client
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId), isNull(recipes.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  if (!head) return null

  const ingredientRows = await client
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.sortOrder))

  return {
    id: head.id,
    userId: head.userId,
    name: head.name,
    servings: Number(head.servings),
    servingName: head.servingName,
    finishedWeightG: head.finishedWeightG === null ? null : Number(head.finishedWeightG),
    notes: head.notes,
    ingredients: ingredientRows.map((row) => ({
      id: row.id,
      foodId: row.foodId,
      foodServingId: row.foodServingId,
      quantity: Number(row.quantity),
      unitLabel: row.unitLabel,
      gramsResolved: row.gramsResolved === null ? null : Number(row.gramsResolved),
      sortOrder: row.sortOrder
    }))
  }
}

export interface IngredientLineInput {
  foodServingId: number
  quantity: number
  unitLabel: string
  gramsResolved: number | null
}

export function resolveIngredientLine(food: FoodForResolve, line: IngredientLineInput): ResolveResult {
  // A mass ingredient stores the gram basis in foodServingId, so quantity is grams, not servings.
  const byMass = normalizeUnitLabel(line.unitLabel).kind === 'weight'
  const pinned = byMass ? undefined : food.servings.find((s) => s.id === line.foodServingId)
  if (pinned) return resolveNutrition(food, { type: 'serving', servingId: pinned.id }, line.quantity)
  if (line.gramsResolved !== null) return resolveNutrition(food, { type: 'mass', unit: 'g' }, line.gramsResolved)
  return resolveNutrition(food, selectUnit(food, line.unitLabel).selection, line.quantity)
}

export async function computeRecipeNutrition(
  client: DbClient,
  userId: number,
  recipe: LoadedRecipe
): Promise<RecipeNutrition> {
  const brokenIngredients: number[] = []
  const ingredients: ResolvedIngredient[] = []

  for (const ingredient of recipe.ingredients) {
    const food = await loadFood(client, userId, ingredient.foodId)
    if (!food) {
      brokenIngredients.push(ingredient.foodId)
      continue
    }

    let resolved
    try {
      resolved = resolveIngredientLine(food, ingredient)
    } catch {
      brokenIngredients.push(ingredient.foodId)
      continue
    }

    ingredients.push({
      foodId: food.id,
      name: food.name,
      quantity: ingredient.quantity,
      unitLabel: ingredient.unitLabel,
      gramsResolved: resolved.gramsResolved,
      nutrients: resolved.nutrients
    })
  }

  const total = sumIngredients(ingredients)
  const perServing = perServingNutrition(total, recipe.servings)

  return { perServing, total, brokenIngredients, ingredients }
}

export async function recipeNutrition(
  client: DbClient,
  userId: number,
  recipeId: number
): Promise<RecipeNutrition | null> {
  const recipe = await loadRecipe(client, userId, recipeId)
  if (!recipe) return null
  return computeRecipeNutrition(client, userId, recipe)
}
