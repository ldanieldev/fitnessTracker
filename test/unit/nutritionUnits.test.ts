import { describe, expect, it } from 'vitest'

describe('mass conversion', () => {
  it('uses the exact international avoirdupois constants', async () => {
    const { MASS_GRAMS } = await import('../../shared/utils/nutritionUnits')
    expect(MASS_GRAMS.g).toBe(1)
    expect(MASS_GRAMS.oz).toBe(28.349523125)
    expect(MASS_GRAMS.lb).toBe(453.59237)
  })

  it('converts a typed amount to grams', async () => {
    const { toGrams } = await import('../../shared/utils/nutritionUnits')
    expect(toGrams(100, 'g')).toBe(100)
    expect(toGrams(8, 'oz')).toBeCloseTo(226.796185, 6)
    expect(toGrams(1.5, 'lb')).toBeCloseTo(680.388555, 6)
  })
})

describe('unit label normalization', () => {
  it('folds every gram spelling onto g', async () => {
    const { normalizeUnitLabel } = await import('../../shared/utils/nutritionUnits')
    for (const raw of ['g', 'G', 'Gram', 'Grams', ' grams ']) {
      expect(normalizeUnitLabel(raw)).toEqual({ kind: 'weight', unit: 'g' })
    }
  })

  it('folds every ounce and pound spelling', async () => {
    const { normalizeUnitLabel } = await import('../../shared/utils/nutritionUnits')
    expect(normalizeUnitLabel('Oz')).toEqual({ kind: 'weight', unit: 'oz' })
    expect(normalizeUnitLabel('Ounces')).toEqual({ kind: 'weight', unit: 'oz' })
    expect(normalizeUnitLabel('lbs')).toEqual({ kind: 'weight', unit: 'lb' })
  })

  it('treats anything else as a named unit and trims it', async () => {
    const { normalizeUnitLabel } = await import('../../shared/utils/nutritionUnits')
    expect(normalizeUnitLabel('  slice ')).toEqual({ kind: 'named', label: 'slice' })
    expect(normalizeUnitLabel('Serving')).toEqual({ kind: 'named', label: 'Serving' })
    expect(normalizeUnitLabel('egg')).toEqual({ kind: 'named', label: 'egg' })
  })

  it('rejects an empty label rather than inventing one', async () => {
    const { normalizeUnitLabel } = await import('../../shared/utils/nutritionUnits')
    expect(() => normalizeUnitLabel('   ')).toThrow(/empty/i)
  })

  it('does not resolve prototype keys as weight units', async () => {
    const { normalizeUnitLabel } = await import('../../shared/utils/nutritionUnits')
    expect(normalizeUnitLabel('constructor')).toEqual({ kind: 'named', label: 'constructor' })
    expect(normalizeUnitLabel('toString')).toEqual({ kind: 'named', label: 'toString' })
  })
})
