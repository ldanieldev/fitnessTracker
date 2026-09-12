import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { FoodForResolve } from '~~/shared/types/nutrition'
import { NoWeightBasisError, defaultServing, resolveNutrition } from '~~/shared/utils/nutritionResolve'
import { foodNutrients, foodServings } from '~~/server/db/schema'
import type { DbClient } from '../db'
import { type ServingNutrientRow, toFoodForResolve } from './loadFood'

export interface PerDefault {
  label: string
  quantity: number
  energy: number | null
  protein: number | null
  carbohydrate: number | null
  fat: number | null
}

const KEYS = ['energy', 'protein', 'carbohydrate', 'fat'] as const

export function perDefaultOf(food: FoodForResolve, idToKey: Map<number, string>): PerDefault | null {
  const serving = defaultServing(food)
  if (!serving) return null
  const out: PerDefault = { label: serving.label, quantity: serving.quantity, energy: null, protein: null, carbohydrate: null, fat: null }
  try {
    const resolved = resolveNutrition(food, { type: 'serving', servingId: serving.id }, serving.quantity)
    for (const [id, amount] of Object.entries(resolved.nutrients)) {
      const key = idToKey.get(Number(id))
      if (key && (KEYS as readonly string[]).includes(key)) out[key as (typeof KEYS)[number]] = amount
    }
  } catch (err) {
    if (!(err instanceof NoWeightBasisError)) throw err
  }
  return out
}

export async function perDefaultByFood(client: DbClient, foodIds: number[]): Promise<Map<number, PerDefault | null>> {
  const { nutrientCatalog } = await import('./nutrientIds')
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))
  const result = new Map<number, PerDefault | null>()
  if (foodIds.length === 0) return result

  const rows = await client
    .select({
      foodId: foodServings.foodId,
      servingId: foodServings.id,
      kind: foodServings.kind,
      label: foodServings.label,
      quantity: foodServings.quantity,
      basisGrams: foodServings.basisGrams,
      hasOwnNutrition: foodServings.hasOwnNutrition,
      nutrientId: foodNutrients.nutrientId,
      amount: foodNutrients.amount
    })
    .from(foodServings)
    .leftJoin(foodNutrients, eq(foodNutrients.foodServingId, foodServings.id))
    .where(and(inArray(foodServings.foodId, foodIds), isNull(foodServings.deletedAt)))

  const byFood = new Map<number, ServingNutrientRow[]>()
  for (const { foodId, ...row } of rows) {
    const list = byFood.get(foodId) ?? []
    list.push(row as ServingNutrientRow)
    byFood.set(foodId, list)
  }
  for (const id of foodIds) result.set(id, perDefaultOf(toFoodForResolve(id, byFood.get(id) ?? []), idToKey))
  return result
}
