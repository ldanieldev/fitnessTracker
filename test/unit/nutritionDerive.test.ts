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

describe('calculatedEnergy', () => {
  it('sums 4/4/9 and counts an absent macro as 0', async () => {
    const { calculatedEnergy } = await import('../../shared/utils/nutritionDerive')
    expect(calculatedEnergy({ protein: 25, carbohydrate: 21.4, fat: 50 })).toBeCloseTo(635.6, 6)
    expect(calculatedEnergy({ protein: 3 })).toBe(12)
    expect(calculatedEnergy({})).toBe(0)
    expect(calculatedEnergy({ protein: null, carbohydrate: null, fat: null })).toBe(0)
  })
})

describe('sourceEnergyMismatch', () => {
  it('flags a source energy far from the macros', async () => {
    const { sourceEnergyMismatch } = await import('../../shared/utils/nutritionDerive')
    expect(sourceEnergyMismatch({ energy: 566.7, protein: 1, carbohydrate: 17, fat: 11 })).toEqual({
      sourceKcal: 566.7,
      macroKcal: 171
    })
  })

  it('accepts egg whites and peanuts', async () => {
    const { sourceEnergyMismatch } = await import('../../shared/utils/nutritionDerive')
    expect(sourceEnergyMismatch({ energy: 54, protein: 10.9, carbohydrate: 0, fat: 0 })).toBeNull()
    expect(sourceEnergyMismatch({ energy: 643, protein: 28.6, carbohydrate: 14.3, fat: 53.6 })).toBeNull()
  })

  it('needs both a 20 kcal and a 15% gap', async () => {
    const { sourceEnergyMismatch } = await import('../../shared/utils/nutritionDerive')
    expect(sourceEnergyMismatch({ energy: 100, protein: 0, carbohydrate: 19, fat: 0 })).toEqual({
      sourceKcal: 100,
      macroKcal: 76
    })
    expect(sourceEnergyMismatch({ energy: 30, protein: 0, carbohydrate: 3, fat: 0 })).toBeNull()
  })

  it('needs a gap strictly past 20 kcal and 15%', async () => {
    const { sourceEnergyMismatch } = await import('../../shared/utils/nutritionDerive')
    expect(sourceEnergyMismatch({ energy: 100, carbohydrate: 20 })).toBeNull()
    expect(sourceEnergyMismatch({ energy: 200, carbohydrate: 42.5 })).toBeNull()
    expect(sourceEnergyMismatch({ energy: 100.01, carbohydrate: 20 })).toEqual({ sourceKcal: 100.01, macroKcal: 80 })
  })

  it('returns null without energy or without any macro', async () => {
    const { sourceEnergyMismatch } = await import('../../shared/utils/nutritionDerive')
    expect(sourceEnergyMismatch({ energy: 200 })).toBeNull()
    expect(sourceEnergyMismatch({ protein: 10 })).toBeNull()
  })
})

describe('hasMacro', () => {
  it('is true only when a protein, carbohydrate or fat key is present', async () => {
    const { hasMacro, ENERGY_MACROS } = await import('../../shared/utils/nutritionDerive')
    expect(ENERGY_MACROS).toEqual(['protein', 'carbohydrate', 'fat'])
    expect(hasMacro(['energy', 'fiber'])).toBe(false)
    expect(hasMacro([])).toBe(false)
    expect(hasMacro(['energy', 'fat'])).toBe(true)
    expect(hasMacro(new Set(['carbohydrate']))).toBe(true)
  })
})
