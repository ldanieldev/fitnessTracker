import { describe, expect, it } from 'vitest'
import type { FoodForResolve } from '../../shared/types/nutrition'

const idToKey = new Map([[1, 'energy'], [2, 'protein'], [3, 'carbohydrate'], [4, 'fat']])

describe('perDefaultOf', () => {
  it('uses the weight serving when present and reports its own quantity', async () => {
    const { perDefaultOf } = await import('../../server/utils/nutrition/perDefault')
    const food: FoodForResolve = { id: 1, servings: [
      { id: 10, kind: 'named', label: 'slice', quantity: 1, basisGrams: null, hasOwnNutrition: true, nutrients: { 1: 90 } },
      { id: 11, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, hasOwnNutrition: true, nutrients: { 1: 260, 2: 9 } }
    ] }
    expect(perDefaultOf(food, idToKey)).toEqual({ label: 'g', quantity: 100, energy: 260, protein: 9, carbohydrate: null, fat: null })
  })

  it('falls back to the lowest-id serving and returns null with no servings', async () => {
    const { perDefaultOf } = await import('../../server/utils/nutrition/perDefault')
    const slice: FoodForResolve = { id: 2, servings: [{ id: 20, kind: 'named', label: 'egg', quantity: 1, basisGrams: null, hasOwnNutrition: true, nutrients: { 1: 69, 4: 5 } }] }
    expect(perDefaultOf(slice, idToKey)).toMatchObject({ label: 'egg', quantity: 1, energy: 69, fat: 5 })
    expect(perDefaultOf({ id: 3, servings: [] }, idToKey)).toBeNull()
  })
})
