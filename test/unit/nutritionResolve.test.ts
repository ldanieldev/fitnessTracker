import { describe, expect, it } from 'vitest'
import type { FoodForResolve, ServingBasis } from '../../shared/types/nutrition'

const P = 1
const C = 2
const F = 3

function serving(over: Partial<ServingBasis> & { id: number }): ServingBasis {
  return {
    kind: 'named',
    label: 'serving',
    quantity: 1,
    basisGrams: null,
    hasOwnNutrition: true,
    nutrients: {},
    ...over
  }
}

// The spec's worked example: two independent, mutually irreconcilable bases on one food.
const pizza: FoodForResolve = {
  id: 1,
  servings: [
    serving({ id: 10, kind: 'named', label: 'slice', quantity: 1, nutrients: { [P]: 3, [C]: 2, [F]: 5 } }),
    serving({
      id: 11,
      kind: 'weight',
      label: 'g',
      quantity: 100,
      basisGrams: 100,
      nutrients: { [P]: 1, [C]: 2, [F]: 2 }
    })
  ]
}

describe('resolveNutrition — weight bases', () => {
  it('scales 47 g off the 100 g basis', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const r = resolveNutrition(pizza, { type: 'mass', unit: 'g' }, 47)
    expect(r.nutrients[P]).toBeCloseTo(0.47, 10)
    expect(r.nutrients[C]).toBeCloseTo(0.94, 10)
    expect(r.nutrients[F]).toBeCloseTo(0.94, 10)
    expect(r.gramsResolved).toBe(47)
  })

  it('scales 300 g off the 100 g basis', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const r = resolveNutrition(pizza, { type: 'mass', unit: 'g' }, 300)
    expect(r.nutrients[P]).toBeCloseTo(3, 10)
    expect(r.nutrients[C]).toBeCloseTo(6, 10)
    expect(r.nutrients[F]).toBeCloseTo(6, 10)
  })

  it('converts 8 oz to grams before scaling', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const r = resolveNutrition(pizza, { type: 'mass', unit: 'oz' }, 8)
    expect(r.gramsResolved).toBeCloseTo(226.796185, 6)
    expect(r.nutrients[P]).toBeCloseTo(2.26796185, 8)
    expect(r.nutrients[C]).toBeCloseTo(4.5359237, 8)
  })
})

describe('resolveNutrition — named bases', () => {
  it('scales 2 slices off the slice basis, never touching the weight basis', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const r = resolveNutrition(pizza, { type: 'serving', servingId: 10 }, 2)
    expect(r.nutrients[P]).toBe(6)
    expect(r.nutrients[C]).toBe(4)
    expect(r.nutrients[F]).toBe(10)
  })

  it('leaves gramsResolved null when the named basis has no gram weight', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    expect(resolveNutrition(pizza, { type: 'serving', servingId: 10 }, 2).gramsResolved).toBeNull()
  })

  it('lets the two bases disagree — they are independent by design', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const bySlice = resolveNutrition(pizza, { type: 'serving', servingId: 10 }, 1)
    const byGram = resolveNutrition(pizza, { type: 'mass', unit: 'g' }, 100)
    expect(bySlice.nutrients[P]).not.toBeCloseTo(byGram.nutrients[P], 5)
  })

  it('derives a serving that carries only a gram weight', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const withCup: FoodForResolve = {
      ...pizza,
      servings: [
        ...pizza.servings,
        serving({ id: 12, label: 'cup', quantity: 1, basisGrams: 120, hasOwnNutrition: false })
      ]
    }
    const r = resolveNutrition(withCup, { type: 'serving', servingId: 12 }, 1)
    expect(r.nutrients[P]).toBeCloseTo(1.2, 10)
    expect(r.gramsResolved).toBeCloseTo(120, 10)
  })

  it('scales a multi-unit basis by quantity, not by row count', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const perTwo: FoodForResolve = {
      id: 2,
      servings: [serving({ id: 20, label: 'cookie', quantity: 2, nutrients: { [P]: 4 } })]
    }
    expect(resolveNutrition(perTwo, { type: 'serving', servingId: 20 }, 3).nutrients[P]).toBeCloseTo(6, 10)
  })
})

describe('selectGramBasis — the 2b fallback chain', () => {
  it('prefers the weight serving when one exists', async () => {
    const { selectGramBasis } = await import('../../shared/utils/nutritionResolve')
    expect(selectGramBasis(pizza)!.id).toBe(11)
  })

  it('falls back to the lowest-id serving that owns nutrition and has a gram weight', async () => {
    const { selectGramBasis, resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const sliceFirst: FoodForResolve = {
      id: 3,
      servings: [
        serving({ id: 30, label: 'slice', quantity: 1, basisGrams: 130, nutrients: { [P]: 3, [C]: 2, [F]: 5 } })
      ]
    }
    expect(selectGramBasis(sliceFirst)!.id).toBe(30)
    const r = resolveNutrition(sliceFirst, { type: 'mass', unit: 'g' }, 100)
    expect(r.nutrients[P]).toBeCloseTo(3 * (100 / 130), 10)
  })

  it('returns null when no serving can produce grams', async () => {
    const { selectGramBasis } = await import('../../shared/utils/nutritionResolve')
    const noGrams: FoodForResolve = {
      id: 4,
      servings: [serving({ id: 40, label: 'slice', nutrients: { [P]: 3 } })]
    }
    expect(selectGramBasis(noGrams)).toBeNull()
  })

  it('throws NO_WEIGHT_BASIS when grams are typed and no gram basis exists', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const noGrams: FoodForResolve = {
      id: 4,
      servings: [serving({ id: 40, label: 'slice', nutrients: { [P]: 3 } })]
    }
    expect(() => resolveNutrition(noGrams, { type: 'mass', unit: 'g' }, 100))
      .toThrow(expect.objectContaining({ code: 'NO_WEIGHT_BASIS' }))
  })

  it('never picks a derived serving as the gram basis, even at a lower id', async () => {
    const { selectGramBasis } = await import('../../shared/utils/nutritionResolve')
    const food: FoodForResolve = {
      id: 6,
      servings: [
        serving({ id: 60, label: 'cup', quantity: 1, basisGrams: 240, hasOwnNutrition: false }),
        serving({ id: 61, label: 'slice', quantity: 1, basisGrams: 130, nutrients: { [P]: 3 } })
      ]
    }
    expect(selectGramBasis(food)!.id).toBe(61)
  })

  it('picks the lowest-id own-nutrition serving when several carry grams', async () => {
    const { selectGramBasis } = await import('../../shared/utils/nutritionResolve')
    const food: FoodForResolve = {
      id: 7,
      servings: [
        serving({ id: 72, label: 'b', quantity: 1, basisGrams: 50, nutrients: { [P]: 1 } }),
        serving({ id: 71, label: 'a', quantity: 1, basisGrams: 80, nutrients: { [P]: 2 } })
      ]
    }
    expect(selectGramBasis(food)!.id).toBe(71)
  })
})

describe('defaultServing', () => {
  it('picks the weight serving when present', async () => {
    const { defaultServing } = await import('../../shared/utils/nutritionResolve')
    expect(defaultServing(pizza)!.id).toBe(11)
  })

  it('otherwise picks the lowest id', async () => {
    const { defaultServing } = await import('../../shared/utils/nutritionResolve')
    const named: FoodForResolve = {
      id: 5,
      servings: [serving({ id: 52, label: 'b' }), serving({ id: 51, label: 'a' })]
    }
    expect(defaultServing(named)!.id).toBe(51)
  })
})

describe('resolveNutrition — guards', () => {
  it('rejects a non-positive quantity', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    expect(() => resolveNutrition(pizza, { type: 'mass', unit: 'g' }, 0)).toThrow(/positive/i)
    expect(() => resolveNutrition(pizza, { type: 'mass', unit: 'g' }, -5)).toThrow(/positive/i)
  })

  it('rejects an unknown serving id', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    expect(() => resolveNutrition(pizza, { type: 'serving', servingId: 999 }, 1)).toThrow(/serving/i)
  })

  it('throws NO_WEIGHT_BASIS rather than Infinity for a zero-gram basis', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const zero: FoodForResolve = {
      id: 8,
      servings: [serving({ id: 80, kind: 'weight', label: 'g', quantity: 100, basisGrams: 0, nutrients: { [P]: 5 } })]
    }
    expect(() => resolveNutrition(zero, { type: 'mass', unit: 'g' }, 50))
      .toThrow(expect.objectContaining({ code: 'NO_WEIGHT_BASIS' }))
  })

  it('reports NO_WEIGHT_BASIS for a derived serving whose gram weight is zero', async () => {
    const { resolveNutrition } = await import('../../shared/utils/nutritionResolve')
    const food: FoodForResolve = {
      ...pizza,
      servings: [...pizza.servings, serving({ id: 13, label: 'pinch', quantity: 1, basisGrams: 0, hasOwnNutrition: false })]
    }
    expect(() => resolveNutrition(food, { type: 'serving', servingId: 13 }, 1))
      .toThrow(expect.objectContaining({ code: 'NO_WEIGHT_BASIS' }))
  })

  it('exposes a stable error name', async () => {
    const { NoWeightBasisError } = await import('../../shared/utils/nutritionResolve')
    expect(new NoWeightBasisError().name).toBe('NoWeightBasisError')
  })
})
