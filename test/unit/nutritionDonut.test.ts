import { describe, expect, it } from 'vitest'

describe('macroDonutSlices', () => {
  it('is empty when protein, carbs and fat are all missing or zero', async () => {
    const { macroDonutSlices } = await import('../../app/utils/nutrition/donut')
    expect(macroDonutSlices({})).toEqual([])
    expect(macroDonutSlices({ protein: 0, carbohydrate: 0, fat: 0 })).toEqual([])
  })

  it('splits calorie share by Atwater factors and sums percentages to exactly 100', async () => {
    const { macroDonutSlices } = await import('../../app/utils/nutrition/donut')
    // 25*4 + 25*4 + 10*9 = 290 kcal -> 34.48/34.48/31.03%, remainder point goes to protein (tied, sorted first).
    const slices = macroDonutSlices({ protein: 25, carbohydrate: 25, fat: 10 })
    expect(slices.map((s) => s.key)).toEqual(['protein', 'carbohydrate', 'fat'])
    expect(slices.map((s) => s.grams)).toEqual([25, 25, 10])
    expect(slices.map((s) => s.percent)).toEqual([35, 34, 31])
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100)
  })

  it('omits a macro with zero grams from the slices', async () => {
    const { macroDonutSlices } = await import('../../app/utils/nutrition/donut')
    const slices = macroDonutSlices({ protein: 0, carbohydrate: 30, fat: 10 })
    expect(slices.map((s) => s.key)).toEqual(['carbohydrate', 'fat'])
    expect(slices.reduce((sum, s) => sum + s.percent, 0)).toBe(100)
  })
})
