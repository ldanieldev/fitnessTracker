import { describe, expect, it } from 'vitest'

const ids = new Map([['energy', 1], ['protein', 2], ['carbohydrate', 3], ['fat', 4]])

describe('buildServingRows', () => {
  it('derives energy from 4/4/9 when the calorie field is blank', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    const [s] = buildServingRows([
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3, carbohydrate: 2, fat: 5 } }
    ], ids)
    expect(s!.nutrients.find((n) => n.nutrientId === 1)!.amount).toBe(3 * 4 + 2 * 4 + 5 * 9)
  })

  it('does not derive energy when a macro is missing at food save', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    const [s] = buildServingRows([
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3, carbohydrate: 2 } }
    ], ids)
    expect(s!.nutrients.some((n) => n.nutrientId === 1)).toBe(false)
  })

  it('rejects an unknown nutrient key instead of dropping it', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    expect(() => buildServingRows([
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3, unobtainium: 1 } }
    ], ids)).toThrow(/Unknown nutrient: unobtainium/)
  })

  it('keeps an explicit calorie value instead of deriving over it', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    const [s] = buildServingRows([
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { energy: 200, protein: 3, carbohydrate: 2, fat: 5 } }
    ], ids)
    expect(s!.nutrients.find((n) => n.nutrientId === 1)!.amount).toBe(200)
  })

  it('normalizes a weight serving label and computes basisGrams', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    const [s] = buildServingRows([
      { kind: 'weight', label: 'Ounces', quantity: 4, nutrients: { protein: 10 } }
    ], ids)
    expect(s!.label).toBe('oz')
    expect(s!.basisGrams).toBeCloseTo(113.3980925, 6)
  })

  it('marks a serving with no nutrients as deriving', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    const [s] = buildServingRows([
      { kind: 'named', label: 'cup', quantity: 1, basisGrams: 120 }
    ], ids)
    expect(s!.hasOwnNutrition).toBe(false)
    expect(s!.nutrients).toEqual([])
  })

  it('rejects a deriving serving with no gram weight — the CHECK would reject it anyway', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    expect(() => buildServingRows([{ kind: 'named', label: 'cup', quantity: 1 }], ids)).toThrow(/gram/i)
  })

  it('rejects more than one weight serving', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    expect(() => buildServingRows([
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1 } },
      { kind: 'weight', label: 'oz', quantity: 4, nutrients: { protein: 10 } }
    ], ids)).toThrow(/one weight/i)
  })

  it('rejects a weight serving with no nutrition — the DB CHECK would 500 otherwise', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    expect(() => buildServingRows([{ kind: 'weight', label: 'g', quantity: 100 }], ids)).toThrow(/nutrition/i)
  })

  it('assigns sort order in input order', async () => {
    const { buildServingRows } = await import('../../server/utils/nutrition/foodInput')
    const rows = buildServingRows([
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3 } },
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1 } }
    ], ids)
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1])
  })
})
