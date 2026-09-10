import { describe, expect, it } from 'vitest'
import type { ExternalFood } from '../../server/utils/nutrition/external/types'

const base: ExternalFood = {
  source: 'off', externalId: '3017624010701', name: 'Nutella', brand: 'Ferrero', barcode: '3017624010701',
  per100g: { energy: 539, protein: 6.3, carbohydrate: 57.5, fat: 30.9, sugar: 56.3, saturatedFat: 10.6, sodium: 43 },
  servingGrams: 15, servingLabel: 'serving', attribution: 'Open Food Facts (ODbL)'
}

describe('mapExternalFood', () => {
  it('turns per-100g into the weight serving with its own nutrition', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    const out = mapExternalFood(base)
    const weight = out.servings.find((s) => s.kind === 'weight')!
    expect(weight).toMatchObject({ kind: 'weight', label: 'g', quantity: 100 })
    expect(weight.nutrients).toMatchObject({ energy: 539, protein: 6.3, sodium: 43 })
  })

  it('adds a derived named serving when a gram weight is known', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    const named = mapExternalFood(base).servings.find((s) => s.kind === 'named')!
    expect(named).toEqual({ kind: 'named', label: 'serving', quantity: 1, basisGrams: 15 })
  })

  it('omits the named serving when no gram weight parsed', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    const out = mapExternalFood({ ...base, servingGrams: null })
    expect(out.servings.every((s) => s.kind === 'weight')).toBe(true)
  })

  it('returns zero servings when the source had no nutrition', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    expect(mapExternalFood({ ...base, per100g: null }).servings).toEqual([])
  })

  it('drops nutrients the catalogue does not know and keeps zeros', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    const out = mapExternalFood({ ...base, per100g: { protein: 0, energy: 100 } })
    expect(out.servings[0]!.nutrients).toEqual({ protein: 0, energy: 100 })
  })

  it('filters unknown nutrient keys out of per100g before building servings', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    const out = mapExternalFood({ ...base, per100g: { energy: 100, protein: 1, iron: 2 } as never })
    expect(out.servings[0]!.nutrients).toEqual({ energy: 100, protein: 1 })
  })

  it('normalises a USDA 12-digit UPC barcode to GTIN-13', async () => {
    const { mapExternalFood } = await import('../../server/utils/nutrition/external/mapExternalFood')
    const out = mapExternalFood({ ...base, source: 'usda', barcode: '094395000172' })
    expect(out.barcode).toBe('0094395000172')
  })
})

describe('parseServingGrams', () => {
  it('parses common serving_size strings', async () => {
    const { parseServingGrams } = await import('../../server/utils/nutrition/external/mapExternalFood')
    expect(parseServingGrams('15 g')).toBe(15)
    expect(parseServingGrams('2 tbsp (37 g)')).toBe(37)
    expect(parseServingGrams('1 cup (240 ml)')).toBeNull()
    expect(parseServingGrams('30g')).toBe(30)
    expect(parseServingGrams(null)).toBeNull()
  })
})
