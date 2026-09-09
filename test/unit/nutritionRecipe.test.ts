import { describe, expect, it } from 'vitest'

describe('sumIngredients', () => {
  it('adds matching nutrients across ingredients', async () => {
    const { sumIngredients } = await import('../../shared/utils/nutritionRecipe')
    expect(sumIngredients([
      { nutrients: { 1: 100, 2: 10 }, gramsResolved: null },
      { nutrients: { 1: 50, 3: 5 }, gramsResolved: null }
    ])).toEqual({ 1: 150, 2: 10, 3: 5 })
  })

  it('returns an empty object for no ingredients', async () => {
    const { sumIngredients } = await import('../../shared/utils/nutritionRecipe')
    expect(sumIngredients([])).toEqual({})
  })
})

describe('perServingNutrition', () => {
  it('divides totals by the serving count', async () => {
    const { perServingNutrition } = await import('../../shared/utils/nutritionRecipe')
    expect(perServingNutrition({ 1: 1600, 2: 80 }, 8)).toEqual({ 1: 200, 2: 10 })
  })

  it('handles fractional servings', async () => {
    const { perServingNutrition } = await import('../../shared/utils/nutritionRecipe')
    expect(perServingNutrition({ 1: 100 }, 2.5)[1]).toBeCloseTo(40, 10)
  })

  it('refuses to divide by zero servings', async () => {
    const { perServingNutrition } = await import('../../shared/utils/nutritionRecipe')
    expect(() => perServingNutrition({ 1: 100 }, 0)).toThrow(/positive/i)
  })
})
