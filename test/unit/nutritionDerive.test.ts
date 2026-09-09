import { describe, expect, it } from 'vitest'

describe('deriveEnergy', () => {
  it('applies 4/4/9', async () => {
    const { deriveEnergy } = await import('../../shared/utils/nutritionDerive')
    expect(deriveEnergy({ protein: 175, carbohydrate: 165, fat: 60 })).toBe(1900)
  })

  it('returns null when every macro is missing, rather than zero', async () => {
    const { deriveEnergy } = await import('../../shared/utils/nutritionDerive')
    expect(deriveEnergy({})).toBeNull()
    expect(deriveEnergy({ protein: null, carbohydrate: null, fat: null })).toBeNull()
  })

  it('treats a present zero as a real value', async () => {
    const { deriveEnergy } = await import('../../shared/utils/nutritionDerive')
    expect(deriveEnergy({ protein: 0, carbohydrate: 0, fat: 0 })).toBe(0)
    expect(deriveEnergy({ protein: 52.8, carbohydrate: 2.84, fat: 0 })).toBeCloseTo(222.56, 6)
  })
})

describe('energyDensity', () => {
  it('reports kcal per 100 g', async () => {
    const { energyDensity } = await import('../../shared/utils/nutritionDerive')
    expect(energyDensity(260, 100)).toBe(260)
    expect(energyDensity(143, 55)).toBeCloseTo(260, 6)
  })

  it('returns null without a gram basis', async () => {
    const { energyDensity } = await import('../../shared/utils/nutritionDerive')
    expect(energyDensity(260, null)).toBeNull()
    expect(energyDensity(null, 100)).toBeNull()
    expect(energyDensity(260, 0)).toBeNull()
  })
})

describe('scaleSnapshot', () => {
  it('scales a frozen snapshot by the quantity ratio', async () => {
    const { scaleSnapshot } = await import('../../shared/utils/nutritionDerive')
    expect(scaleSnapshot({ 1: 20, 2: 30 }, 100, 150)).toEqual({ 1: 30, 2: 45 })
  })

  it('is identity when the quantity is unchanged', async () => {
    const { scaleSnapshot } = await import('../../shared/utils/nutritionDerive')
    expect(scaleSnapshot({ 1: 20 }, 100, 100)).toEqual({ 1: 20 })
  })

  it('rejects a non-positive source quantity', async () => {
    const { scaleSnapshot } = await import('../../shared/utils/nutritionDerive')
    expect(() => scaleSnapshot({ 1: 20 }, 0, 50)).toThrow(/positive/i)
  })
})
