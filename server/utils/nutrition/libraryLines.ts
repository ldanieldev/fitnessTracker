import { inArray } from 'drizzle-orm'
import { foods } from '~~/server/db/schema'
import { keyNutrients, sumKeyed } from '~~/shared/utils/nutritionKeyed'
import type { DbClient } from '../db'
import { loadFoods, type LoadedFood } from './loadFood'
import { type IngredientLineInput, resolveIngredientLine } from './recipeTotals'

export interface LibraryLineInput extends IngredientLineInput {
  id: number
  foodId: number
  sortOrder: number
}

export type DescribedLine = LibraryLineInput & {
  name: string | null
  brand: string | null
  nutrients: Record<string, number>
  broken: boolean
}

export interface LineFoods {
  heads: Map<number, { id: number; name: string; brand: string | null }>
  foods: Map<number, LoadedFood>
}

export async function loadLineFoods(client: DbClient, userId: number, foodIds: number[]): Promise<LineFoods> {
  const ids = [...new Set(foodIds)]
  // Deleted foods still need a name for the broken-row label, so heads are read without the deleted filter.
  const heads = ids.length
    ? await client
        .select({ id: foods.id, name: foods.name, brand: foods.brand })
        .from(foods)
        .where(inArray(foods.id, ids))
    : []
  return { heads: new Map(heads.map((h) => [h.id, h])), foods: await loadFoods(client, userId, ids) }
}

export async function describeLines(
  client: DbClient,
  userId: number,
  lines: LibraryLineInput[],
  preloaded?: LineFoods
): Promise<{ lines: DescribedLine[]; total: Record<string, number> }> {
  const { nutrientCatalog } = await import('./nutrientIds')
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))
  const { heads: headById, foods: foodsById } =
    preloaded ??
    (await loadLineFoods(
      client,
      userId,
      lines.map((line) => line.foodId)
    ))

  const described: DescribedLine[] = []
  for (const line of lines) {
    const head = headById.get(line.foodId)
    const food = foodsById.get(line.foodId) ?? null
    let nutrients: Record<string, number> = {}
    let broken = food === null
    if (food) {
      try {
        nutrients = keyNutrients(resolveIngredientLine(food, line).nutrients, idToKey)
      } catch {
        broken = true
      }
    }
    described.push({ ...line, name: head?.name ?? null, brand: head?.brand ?? null, nutrients, broken })
  }

  return { lines: described, total: sumKeyed(described.filter((l) => !l.broken)) }
}
