import type { ResolveResult } from '../types/nutrition'

export interface IngredientSnapshotItem {
  foodId: number
  name: string
  quantity: number
  unitLabel: string
  gramsResolved: number | null
  nutrients: Record<string, number>
}

export function scaleIngredientSnapshot(items: IngredientSnapshotItem[], ratio: number): IngredientSnapshotItem[] {
  return items.map((item) => ({
    ...item,
    quantity: item.quantity * ratio,
    gramsResolved: item.gramsResolved === null ? null : item.gramsResolved * ratio,
    nutrients: Object.fromEntries(Object.entries(item.nutrients).map(([key, amount]) => [key, amount * ratio]))
  }))
}

export function sumIngredients(resolved: ResolveResult[]): Record<number, number> {
  const total: Record<number, number> = {}
  for (const item of resolved) {
    for (const [id, amount] of Object.entries(item.nutrients)) {
      total[Number(id)] = (total[Number(id)] ?? 0) + amount
    }
  }
  return total
}

export function perServingNutrition(
  totals: Record<number, number>,
  servings: number
): Record<number, number> {
  if (!(servings > 0)) {
    throw new Error('Recipe servings must be positive')
  }
  const out: Record<number, number> = {}
  for (const [id, amount] of Object.entries(totals)) {
    out[Number(id)] = amount / servings
  }
  return out
}
