import { describe, expect, it } from 'vitest'

describe('ratioToGrams', () => {
  it('converts a 40/30/30 split at 2000 kcal', async () => {
    const { ratioToGrams } = await import('../../shared/utils/nutritionGoals')
    const g = ratioToGrams(2000, { protein: 40, carbohydrate: 30, fat: 30 })
    expect(g.protein).toBeCloseTo(200, 6)
    expect(g.carbohydrate).toBeCloseTo(150, 6)
    expect(g.fat).toBeCloseTo(66.6667, 3)
  })

  it('reproduces the 1900 kcal cut targets from the plan', async () => {
    const { ratioToGrams } = await import('../../shared/utils/nutritionGoals')
    const g = ratioToGrams(1900, { protein: 36.84, carbohydrate: 34.74, fat: 28.42 })
    expect(g.protein).toBeCloseTo(175, 0)
    expect(g.carbohydrate).toBeCloseTo(165, 0)
    expect(g.fat).toBeCloseTo(60, 0)
  })

  it('rejects ratios that do not sum to 100', async () => {
    const { ratioToGrams } = await import('../../shared/utils/nutritionGoals')
    expect(() => ratioToGrams(2000, { protein: 40, carbohydrate: 30, fat: 20 })).toThrow(/100/)
  })

  it('rejects a non-positive calorie figure', async () => {
    const { ratioToGrams } = await import('../../shared/utils/nutritionGoals')
    expect(() => ratioToGrams(0, { protein: 40, carbohydrate: 30, fat: 30 })).toThrow(/positive/i)
  })
})
