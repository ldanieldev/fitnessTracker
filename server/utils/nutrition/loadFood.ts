import { and, eq, isNull, or } from 'drizzle-orm'
import type { FoodForResolve, ServingBasis, ServingKind } from '~~/shared/types/nutrition'
import { foodNutrients, foods, foodServings } from '~~/server/db/schema'
import type { DbClient } from '../db'

export interface ServingNutrientRow {
  servingId: number
  kind: string
  label: string
  quantity: string
  basisGrams: string | null
  hasOwnNutrition: boolean
  nutrientId: number | null
  amount: string | null
}

export interface LoadedFood extends FoodForResolve {
  name: string
  brand: string | null
  barcode: string | null
  createdByUserId: number | null
  deletedAt: Date | null
}

// node-postgres returns numeric as a string; Number() here is what keeps every downstream sum arithmetic.
export function toFoodForResolve(foodId: number, rows: ServingNutrientRow[]): FoodForResolve {
  const byServing = new Map<number, ServingBasis>()
  for (const row of rows) {
    let serving = byServing.get(row.servingId)
    if (!serving) {
      serving = {
        id: row.servingId,
        kind: row.kind as ServingKind,
        label: row.label,
        quantity: Number(row.quantity),
        basisGrams: row.basisGrams === null ? null : Number(row.basisGrams),
        hasOwnNutrition: row.hasOwnNutrition,
        nutrients: {}
      }
      byServing.set(row.servingId, serving)
    }
    if (row.nutrientId !== null && row.amount !== null) {
      serving.nutrients[row.nutrientId] = Number(row.amount)
    }
  }
  return { id: foodId, servings: [...byServing.values()].sort((a, b) => a.id - b.id) }
}

export async function loadFood(client: DbClient, userId: number, foodId: number): Promise<LoadedFood | null> {
  const head = await client
    .select()
    .from(foods)
    .where(
      and(
        eq(foods.id, foodId),
        isNull(foods.deletedAt),
        or(isNull(foods.createdByUserId), eq(foods.createdByUserId, userId))
      )
    )
    .limit(1)
    .then((r) => r[0])

  if (!head) return null

  const rows = await client
    .select({
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
    .where(and(eq(foodServings.foodId, foodId), isNull(foodServings.deletedAt)))

  return {
    ...toFoodForResolve(foodId, rows as ServingNutrientRow[]),
    name: head.name,
    brand: head.brand,
    barcode: head.barcode,
    createdByUserId: head.createdByUserId,
    deletedAt: head.deletedAt
  }
}
