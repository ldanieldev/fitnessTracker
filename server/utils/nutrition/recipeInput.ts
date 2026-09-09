import { z } from 'zod'
import { NoWeightBasisError, resolveNutrition, selectGramBasis } from '~~/shared/utils/nutritionResolve'
import { recipeIngredients, recipes } from '~~/server/db/schema'
import type { DbClient } from '../db'
import { selectUnit } from './entry'
import { loadFood, type LoadedFood } from './loadFood'

export const recipeIngredientInputSchema = z.object({
  foodId: z.number().int(),
  foodServingId: z.number().int().optional(),
  quantity: z.number().positive(),
  unitLabel: z.string().min(1).max(64)
})

export const recipeSchema = z.object({
  name: z.string().min(1).max(255),
  servings: z.number().positive(),
  servingName: z.string().min(1).max(64),
  notes: z.string().max(5000).nullish(),
  ingredients: z.array(recipeIngredientInputSchema).min(1)
})

export type RecipeInput = z.infer<typeof recipeSchema>
export type RecipeIngredientInput = z.infer<typeof recipeIngredientInputSchema>

export interface PreparedIngredient {
  foodId: number
  foodServingId: number
  quantity: number
  unitLabel: string
  gramsResolved: number | null
}

export function resolveIngredientGrams(food: LoadedFood, ingredient: RecipeIngredientInput): PreparedIngredient {
  const { selection, unitLabel, foodServingId } = selectUnit(food, ingredient.unitLabel)

  let resolved
  try {
    resolved = resolveNutrition(food, selection, ingredient.quantity)
  } catch (err) {
    if (err instanceof NoWeightBasisError) {
      throw createError({ statusCode: 400, statusMessage: 'NO_WEIGHT_BASIS', data: { code: 'NO_WEIGHT_BASIS' } })
    }
    throw err
  }

  return {
    foodId: food.id,
    foodServingId: foodServingId ?? selectGramBasis(food)!.id,
    quantity: ingredient.quantity,
    unitLabel,
    gramsResolved: resolved.gramsResolved
  }
}

export async function createRecipe(tx: DbClient, userId: number, input: RecipeInput): Promise<number> {
  const prepared: PreparedIngredient[] = []
  for (const ingredient of input.ingredients) {
    const food = await loadFood(tx, userId, ingredient.foodId)
    if (!food) throw createError({ statusCode: 404, statusMessage: `Food not found: ${ingredient.foodId}` })
    prepared.push(resolveIngredientGrams(food, ingredient))
  }

  const recipe = await tx
    .insert(recipes)
    .values({
      userId,
      name: input.name,
      servings: String(input.servings),
      servingName: input.servingName,
      notes: input.notes ?? null
    })
    .returning()
    .then((r) => r[0]!)

  await tx.insert(recipeIngredients).values(
    prepared.map((ingredient, sortOrder) => ({
      recipeId: recipe.id,
      foodId: ingredient.foodId,
      foodServingId: ingredient.foodServingId,
      quantity: String(ingredient.quantity),
      unitLabel: ingredient.unitLabel,
      gramsResolved: ingredient.gramsResolved === null ? null : String(ingredient.gramsResolved),
      sortOrder
    }))
  )

  return recipe.id
}
