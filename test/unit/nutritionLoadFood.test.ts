import { describe, expect, it } from 'vitest'

const rows = [
  { servingId: 11, kind: 'weight', label: 'g', quantity: '100', basisGrams: '100',
    hasOwnNutrition: true, nutrientId: 1, amount: '1' },
  { servingId: 11, kind: 'weight', label: 'g', quantity: '100', basisGrams: '100',
    hasOwnNutrition: true, nutrientId: 2, amount: '2' },
  { servingId: 10, kind: 'named', label: 'slice', quantity: '1', basisGrams: null,
    hasOwnNutrition: true, nutrientId: 1, amount: '3' }
]

describe('toFoodForResolve', () => {
  it('coerces every numeric string to a number', async () => {
    const { toFoodForResolve } = await import('../../server/utils/nutrition/loadFood')
    const food = toFoodForResolve(7, rows)
    const weight = food.servings.find((s) => s.id === 11)!
    expect(weight.quantity).toBe(100)
    expect(weight.basisGrams).toBe(100)
    expect(weight.nutrients[1]).toBe(1)
    expect(typeof weight.nutrients[2]).toBe('number')
  })

  it('groups nutrient rows under their serving', async () => {
    const { toFoodForResolve } = await import('../../server/utils/nutrition/loadFood')
    const food = toFoodForResolve(7, rows)
    expect(food.servings).toHaveLength(2)
    expect(food.servings.find((s) => s.id === 11)!.nutrients).toEqual({ 1: 1, 2: 2 })
    expect(food.servings.find((s) => s.id === 10)!.nutrients).toEqual({ 1: 3 })
  })

  it('keeps a null basisGrams null rather than coercing it to zero', async () => {
    const { toFoodForResolve } = await import('../../server/utils/nutrition/loadFood')
    expect(toFoodForResolve(7, rows).servings.find((s) => s.id === 10)!.basisGrams).toBeNull()
  })

  it('retains a serving that has no nutrient rows at all', async () => {
    const { toFoodForResolve } = await import('../../server/utils/nutrition/loadFood')
    const derived = [{ servingId: 12, kind: 'named', label: 'cup', quantity: '1', basisGrams: '120',
      hasOwnNutrition: false, nutrientId: null, amount: null }]
    const food = toFoodForResolve(7, derived)
    expect(food.servings).toHaveLength(1)
    expect(food.servings[0]!.nutrients).toEqual({})
    expect(food.servings[0]!.basisGrams).toBe(120)
  })

  it('resolves end to end against the resolver', async () => {
    const { toFoodForResolve } = await import('../../server/utils/nutrition/loadFood')
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const r = resolveNutrition(toFoodForResolve(7, rows), { type: 'mass', unit: 'g' }, 47)
    expect(r.nutrients[1]).toBeCloseTo(0.47, 10)
  })
})
