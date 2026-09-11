import { describe, expect, it } from 'vitest'
import type { FoodForResolve } from '../../shared/types/nutrition'

const food: FoodForResolve = {
  id: 1,
  servings: [
    { id: 10, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100, hasOwnNutrition: true, nutrients: { 1: 260 } },
    { id: 11, kind: 'named', label: 'slice', quantity: 1, basisGrams: 40, hasOwnNutrition: true, nutrients: { 1: 120 } }
  ]
}

describe('resolveIngredientLine', () => {
  it('resolves a named line through its pinned serving, never the weight basis', async () => {
    const { resolveIngredientLine } = await import('../../server/utils/nutrition/recipeTotals')
    const r = resolveIngredientLine(food, { foodServingId: 11, quantity: 2, unitLabel: 'slice', gramsResolved: 80 })
    expect(r.nutrients[1]).toBeCloseTo(240, 10)
  })

  it('resolves a mass line by its pinned grams', async () => {
    const { resolveIngredientLine } = await import('../../server/utils/nutrition/recipeTotals')
    const r = resolveIngredientLine(food, { foodServingId: 10, quantity: 50, unitLabel: 'g', gramsResolved: 50 })
    expect(r.nutrients[1]).toBeCloseTo(130, 10)
  })

  it('throws when the pinned serving is gone and nothing else resolves', async () => {
    const { resolveIngredientLine } = await import('../../server/utils/nutrition/recipeTotals')
    const namedOnly: FoodForResolve = { id: 2, servings: [] }
    expect(() => resolveIngredientLine(namedOnly, { foodServingId: 99, quantity: 1, unitLabel: 'cup', gramsResolved: null })).toThrow()
  })
})

describe('keyNutrients and sumKeyed', () => {
  it('maps ids to keys, dropping unknown ids, and sums keyed lines', async () => {
    const { keyNutrients, sumKeyed } = await import('../../shared/utils/nutritionKeyed')
    expect(keyNutrients({ 1: 5, 2: 3, 9: 1 }, new Map([[1, 'energy'], [2, 'protein']]))).toEqual({ energy: 5, protein: 3 })
    expect(sumKeyed([{ nutrients: { energy: 5 } }, { nutrients: { energy: 2, fat: 1 } }])).toEqual({ energy: 7, fat: 1 })
  })
})
