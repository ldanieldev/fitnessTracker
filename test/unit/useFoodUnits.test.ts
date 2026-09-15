import { describe, expect, it } from 'vitest'
import type { FoodForResolve } from '../../shared/types/nutrition'

const withWeight: FoodForResolve = {
  id: 1,
  servings: [
    { id: 10, kind: 'named', label: 'slice', quantity: 1, basisGrams: null,
      hasOwnNutrition: true, nutrients: { 1: 3 } },
    { id: 11, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100,
      hasOwnNutrition: true, nutrients: { 1: 1 } }
  ]
}

const sliceOnly: FoodForResolve = {
  id: 2,
  servings: [{ id: 20, kind: 'named', label: 'slice', quantity: 1, basisGrams: null,
    hasOwnNutrition: true, nutrients: { 1: 3 } }]
}

describe('availableUnits', () => {
  it('offers g, oz and lb when a gram basis exists', async () => {
    const { availableUnits } = await import('../../app/composables/useFoodUnits')
    expect(availableUnits(withWeight).filter((u) => u.kind === 'mass').map((u) => u.value))
      .toEqual(['g', 'oz', 'lb'])
  })

  it('offers NO mass units when the food has no gram basis', async () => {
    const { availableUnits } = await import('../../app/composables/useFoodUnits')
    expect(availableUnits(sliceOnly).some((u) => u.kind === 'mass')).toBe(false)
  })

  it('offers mass units for a slice-only food that carries a gram weight', async () => {
    const { availableUnits } = await import('../../app/composables/useFoodUnits')
    const weighed = { ...sliceOnly, servings: [{ ...sliceOnly.servings[0]!, basisGrams: 130 }] }
    expect(availableUnits(weighed).some((u) => u.kind === 'mass')).toBe(true)
  })

  it('always offers every named serving', async () => {
    const { availableUnits } = await import('../../app/composables/useFoodUnits')
    expect(availableUnits(withWeight).find((u) => u.value === 'slice')?.servingId).toBe(10)
  })

  it('never offers the weight serving as a named option — g already comes from the mass list', async () => {
    const { availableUnits } = await import('../../app/composables/useFoodUnits')
    expect(availableUnits(withWeight).filter((u) => u.kind === 'serving').map((u) => u.value)).toEqual(['slice'])
  })
})

describe('defaultUnit', () => {
  it('opens on grams when a weight serving exists', async () => {
    const { defaultUnit } = await import('../../app/composables/useFoodUnits')
    expect(defaultUnit(withWeight)).toBe('g')
  })

  it('otherwise opens on the lowest-id serving label', async () => {
    const { defaultUnit } = await import('../../app/composables/useFoodUnits')
    expect(defaultUnit(sliceOnly)).toBe('slice')
  })
})
