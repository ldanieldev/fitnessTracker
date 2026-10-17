import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FoodForResolve, ServingBasis } from '../../shared/types/nutrition'
import { selectStoredUnit } from '../../server/utils/nutrition/entry'

const serving = (id: number, label: string): ServingBasis => ({
  id,
  kind: 'named',
  label,
  quantity: 1,
  basisGrams: 30,
  hasOwnNutrition: false,
  nutrients: {}
})
const food: FoodForResolve = { id: 1, servings: [serving(10, 'slice'), serving(11, 'slice'), serving(12, 'cup')] }

beforeEach(() => {
  vi.stubGlobal('createError', createError)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('selectStoredUnit', () => {
  it('pins the stored serving among servings sharing its label', () => {
    expect(selectStoredUnit(food, 'slice', 11)).toMatchObject({ foodServingId: 11, unitLabel: 'slice' })
  })

  it('ignores a serving id whose label differs and resolves by the label instead', () => {
    expect(selectStoredUnit(food, 'cup', 11)).toMatchObject({ foodServingId: 12, unitLabel: 'cup' })
    expect(() => selectStoredUnit(food, 'bowl', 11)).toThrow(expect.objectContaining({ statusCode: 400 }))
  })

  it('never pins a weight label', () => {
    expect(selectStoredUnit(food, 'g', 11)).toMatchObject({ foodServingId: null, unitLabel: 'g' })
  })
})
