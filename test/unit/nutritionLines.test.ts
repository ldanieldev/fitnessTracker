import { describe, expect, it } from 'vitest'
import type { FoodDetail } from '../../app/types/nutrition'

const idToKey = new Map([[1, 'energy'], [2, 'protein']])

function food(id: number, servings: FoodDetail['servings']): FoodDetail {
  return { id, name: `Food ${id}`, brand: null, barcode: null, createdByUserId: 1, source: null, defaultServingId: null, energyDensity: null, servings }
}

const oats = food(1, [{ id: 10, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, hasOwnNutrition: true, nutrients: { 1: 380, 2: 13 } }])
const milk = food(2, [{ id: 20, kind: 'named', label: 'cup', quantity: 1, basisGrams: null, hasOwnNutrition: true, nutrients: { 1: 120, 2: 8 } }])

describe('editor lines', () => {
  it('totals resolvable lines, excludes broken ones, and divides per serving', async () => {
    const { linesTotal, divideKeyed, isLineBroken, nextUid } = await import('../../app/utils/nutrition/lines')
    const lines = [
      { uid: nextUid(), foodId: 1, name: 'Oats', brand: null, quantity: 50, unitLabel: 'g', food: oats },
      { uid: nextUid(), foodId: 2, name: 'Milk', brand: null, quantity: 1, unitLabel: 'cup', food: milk },
      { uid: nextUid(), foodId: 3, name: 'Gone', brand: null, quantity: 1, unitLabel: 'cup', food: null },
      { uid: nextUid(), foodId: 2, name: 'Milk', brand: null, quantity: 1, unitLabel: 'g', food: milk }
    ]
    expect(lines.map(isLineBroken)).toEqual([false, false, true, true])
    const total = linesTotal(lines, idToKey)
    expect(total.energy).toBeCloseTo(310, 10)
    expect(total.protein).toBeCloseTo(14.5, 10)
    expect(divideKeyed(total, 2).energy).toBeCloseTo(155, 10)
    expect(new Set(lines.map((l) => l.uid)).size).toBe(4)
  })

  it('builds the request payload without client-only fields', async () => {
    const { linesPayload } = await import('../../app/utils/nutrition/lines')
    expect(linesPayload([{ uid: 'x', foodId: 1, name: 'Oats', brand: null, quantity: 50, unitLabel: 'g', food: oats }]))
      .toEqual([{ foodId: 1, quantity: 50, unitLabel: 'g' }])
  })
})
