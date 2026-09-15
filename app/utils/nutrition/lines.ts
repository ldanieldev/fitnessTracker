import type { FoodDetail } from '~~/app/types/nutrition'
import { keyNutrients, sumKeyed } from '~~/shared/utils/nutritionKeyed'
import { resolveByLabel } from '~~/app/utils/nutrition/resolveByLabel'

export interface EditorLine {
  uid: string
  foodId: number
  name: string
  brand: string | null
  quantity: number
  unitLabel: string
  food: FoodDetail | null
}

let sequence = 0

// A counter, not crypto.randomUUID, which is unavailable on the plain-HTTP LAN origin (not a secure context).
export function nextUid(): string {
  sequence += 1
  return `line-${sequence}`
}

export function lineNutrients(line: EditorLine, idToKey: Map<number, string>): Record<string, number> | null {
  if (!line.food) return null
  const byId = resolveByLabel(line.food, line.unitLabel, line.quantity)
  return byId ? keyNutrients(byId, idToKey) : null
}

export function isLineBroken(line: EditorLine): boolean {
  return !line.food || resolveByLabel(line.food, line.unitLabel, line.quantity) === null
}

export function linesTotal(lines: EditorLine[], idToKey: Map<number, string>): Record<string, number> {
  return sumKeyed(lines.map((line) => ({ nutrients: lineNutrients(line, idToKey) ?? {} })))
}

export function divideKeyed(values: Record<string, number>, by: number): Record<string, number> {
  return Object.fromEntries(Object.entries(values).map(([key, amount]) => [key, amount / by]))
}

export function linesPayload(lines: EditorLine[]) {
  return lines.map(({ foodId, quantity, unitLabel }) => ({ foodId, quantity, unitLabel }))
}

export async function loadEditorLines(
  lines: Array<{ foodId: number, name: string | null, brand: string | null, quantity: number, unitLabel: string }>
): Promise<EditorLine[]> {
  return Promise.all(
    lines.map(async (line) => {
      const food = await apiFetch<FoodDetail>(`/api/nutrition/foods/${line.foodId}`).catch(() => null)
      return {
        uid: nextUid(),
        foodId: line.foodId,
        name: line.name ?? food?.name ?? 'Unknown food',
        brand: line.brand,
        quantity: line.quantity,
        unitLabel: line.unitLabel,
        food
      }
    })
  )
}
