import { describe, expect, it } from 'vitest'
import type { FoodForResolve } from '../../shared/types/nutrition'

const food: FoodForResolve = {
  id: 1,
  servings: [
    { id: 11, kind: 'weight', label: 'g', quantity: 100, basisGrams: 100,
      hasOwnNutrition: true, nutrients: { 1: 260 } },
    { id: 12, kind: 'named', label: 'cup', quantity: 1, basisGrams: 120,
      hasOwnNutrition: false, nutrients: {} },
    { id: 13, kind: 'named', label: 'slice', quantity: 1, basisGrams: null,
      hasOwnNutrition: true, nutrients: { 1: 200 } }
  ]
}

describe('assertCanDeleteServing', () => {
  it('blocks deleting the only gram basis while a serving derives from it', async () => {
    const { assertCanDeleteServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanDeleteServing(food, 11)).toThrow(expect.objectContaining({ code: 'SERVING_IN_USE' }))
  })

  it('allows deleting the deriving serving itself', async () => {
    const { assertCanDeleteServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanDeleteServing(food, 12)).not.toThrow()
  })

  it('allows deleting an independent named basis', async () => {
    const { assertCanDeleteServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanDeleteServing(food, 13)).not.toThrow()
  })

  it('allows deleting the gram basis once nothing derives from it', async () => {
    const { assertCanDeleteServing } = await import('../../server/utils/nutrition/servingGuards')
    const noDerived = { ...food, servings: food.servings.filter((s) => s.id !== 12) }
    expect(() => assertCanDeleteServing(noDerived, 11)).not.toThrow()
  })

  it('throws on an unknown serving', async () => {
    const { assertCanDeleteServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanDeleteServing(food, 99)).toThrow(/unknown/i)
  })
})

describe('assertCanReplaceServing', () => {
  it('blocks turning the only gram basis into a gram-less named serving while a serving derives', async () => {
    const { assertCanReplaceServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanReplaceServing(food, 11, { kind: 'named', basisGrams: null, hasOwnNutrition: true }))
      .toThrow(expect.objectContaining({ code: 'SERVING_IN_USE' }))
  })

  it('allows the same edit when the replacement keeps a gram weight', async () => {
    const { assertCanReplaceServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanReplaceServing(food, 11, { kind: 'named', basisGrams: 100, hasOwnNutrition: true }))
      .not.toThrow()
  })

  it('allows editing a serving nothing derives from', async () => {
    const { assertCanReplaceServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanReplaceServing(food, 13, { kind: 'named', basisGrams: null, hasOwnNutrition: true }))
      .not.toThrow()
  })

  it('allows removing the gram basis once nothing derives from it', async () => {
    const { assertCanReplaceServing } = await import('../../server/utils/nutrition/servingGuards')
    const noDerived = { ...food, servings: food.servings.filter((s) => s.id !== 12) }
    expect(() => assertCanReplaceServing(noDerived, 11, { kind: 'named', basisGrams: null, hasOwnNutrition: true }))
      .not.toThrow()
  })

  it('throws on an unknown serving', async () => {
    const { assertCanReplaceServing } = await import('../../server/utils/nutrition/servingGuards')
    expect(() => assertCanReplaceServing(food, 99, { kind: 'named', basisGrams: null, hasOwnNutrition: true }))
      .toThrow(/unknown/i)
  })
})
