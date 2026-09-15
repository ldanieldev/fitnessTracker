import { inArray } from 'drizzle-orm'
import { foods } from '~~/server/db/schema'
import { keyNutrients, sumKeyed } from '~~/shared/utils/nutritionKeyed'
import type { DbClient } from '../db'
import { loadFood } from './loadFood'
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

export async function describeLines(
  client: DbClient,
  userId: number,
  lines: LibraryLineInput[]
): Promise<{ lines: DescribedLine[], total: Record<string, number> }> {
  const { nutrientCatalog } = await import('./nutrientIds')
  const idToKey = new Map((await nutrientCatalog()).map((n) => [n.id, n.key]))

  // Deleted foods still need a name for the broken-row label, so heads are read without the deleted filter.
  const heads = lines.length
    ? await client
        .select({ id: foods.id, name: foods.name, brand: foods.brand })
        .from(foods)
        .where(inArray(foods.id, [...new Set(lines.map((l) => l.foodId))]))
    : []
  const headById = new Map(heads.map((h) => [h.id, h]))

  const described: DescribedLine[] = []
  for (const line of lines) {
    const head = headById.get(line.foodId)
    const food = await loadFood(client, userId, line.foodId)
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
