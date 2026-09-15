import { z } from 'zod'
import { savedMealItems, savedMeals } from '~~/server/db/schema'
import type { DbClient } from '../db'
import { loadFood } from './loadFood'
import { type PreparedIngredient, resolveIngredientGrams } from './recipeInput'

export const savedMealItemInputSchema = z.object({
  foodId: z.number().int(),
  foodServingId: z.number().int().optional(),
  quantity: z.number().positive(),
  unitLabel: z.string().trim().min(1).max(64)
})

export const savedMealSchema = z.object({
  name: z.string().min(1).max(255),
  items: z.array(savedMealItemInputSchema).min(1)
})

export type SavedMealInput = z.infer<typeof savedMealSchema>
export type SavedMealItemInput = z.infer<typeof savedMealItemInputSchema>

export async function createSavedMeal(tx: DbClient, userId: number, input: SavedMealInput): Promise<number> {
  const prepared: PreparedIngredient[] = []
  for (const item of input.items) {
    const food = await loadFood(tx, userId, item.foodId)
    if (!food) throw createError({ statusCode: 404, statusMessage: `Food not found: ${item.foodId}` })
    prepared.push(resolveIngredientGrams(food, item))
  }

  const savedMeal = await tx
    .insert(savedMeals)
    .values({ userId, name: input.name })
    .returning()
    .then((r) => r[0]!)

  await tx.insert(savedMealItems).values(
    prepared.map((item, sortOrder) => ({
      savedMealId: savedMeal.id,
      foodId: item.foodId,
      foodServingId: item.foodServingId,
      quantity: String(item.quantity),
      unitLabel: item.unitLabel,
      gramsResolved: item.gramsResolved === null ? null : String(item.gramsResolved),
      sortOrder
    }))
  )

  return savedMeal.id
}
