import { and, eq, inArray, isNull, or } from 'drizzle-orm'
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
  sourceId: number | null
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
  return (await loadFoods(client, userId, [foodId])).get(foodId) ?? null
}

/** Batch `loadFood` in two queries; foods the user cannot see, or deleted ones, are missing from the map. */
export async function loadFoods(client: DbClient, userId: number, foodIds: number[]): Promise<Map<number, LoadedFood>> {
  const ids = [...new Set(foodIds)]
  if (!ids.length) return new Map()
  const heads = await client
    .select()
    .from(foods)
    .where(
      and(
        inArray(foods.id, ids),
        isNull(foods.deletedAt),
        or(isNull(foods.createdByUserId), eq(foods.createdByUserId, userId))
      )
    )
  if (!heads.length) return new Map()

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
    .where(
      and(
        inArray(
          foodServings.foodId,
          heads.map((head) => head.id)
        ),
        isNull(foodServings.deletedAt)
      )
    )
  const rowsByFood = new Map<number, ServingNutrientRow[]>()
  for (const { foodId, ...row } of rows) {
    const list = rowsByFood.get(foodId) ?? []
    list.push(row as ServingNutrientRow)
    rowsByFood.set(foodId, list)
  }

  return new Map(
    heads.map((head) => [
      head.id,
      {
        ...toFoodForResolve(head.id, rowsByFood.get(head.id) ?? []),
        name: head.name,
        brand: head.brand,
        barcode: head.barcode,
        createdByUserId: head.createdByUserId,
        sourceId: head.sourceId,
        deletedAt: head.deletedAt
      }
    ])
  )
}
