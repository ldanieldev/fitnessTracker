import { and, asc, eq, isNull } from 'drizzle-orm'
import { savedMealItems, savedMeals } from '~~/server/db/schema'
import type { DbClient } from '../db'

export interface SavedMealItemRow {
  id: number
  foodId: number
  foodServingId: number
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  sortOrder: number
}

export interface LoadedSavedMeal {
  id: number
  userId: number
  name: string
  items: SavedMealItemRow[]
}

export async function loadSavedMeal(
  client: DbClient,
  userId: number,
  savedMealId: number
): Promise<LoadedSavedMeal | null> {
  const head = await client
    .select()
    .from(savedMeals)
    .where(and(eq(savedMeals.id, savedMealId), eq(savedMeals.userId, userId), isNull(savedMeals.deletedAt)))
    .limit(1)
    .then((r) => r[0])
  if (!head) return null

  const itemRows = await client
    .select()
    .from(savedMealItems)
    .where(eq(savedMealItems.savedMealId, savedMealId))
    .orderBy(asc(savedMealItems.sortOrder))

  return {
    id: head.id,
    userId: head.userId,
    name: head.name,
    items: itemRows.map((row) => ({
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
