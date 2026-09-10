import { describe, expect, it, vi, afterEach } from 'vitest'
import usdaSearchCheddar from '../fixtures/external/usda-search-cheddar.json'
import usdaFoodDetail from '../fixtures/external/usda-food-2057648.json'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usdaHitToExternal from a search hit', () => {
  it('maps the cheddar hit to per-100g nutrients keyed by nutrientNumber', async () => {
    const { usdaHitToExternal } = await import('../../server/utils/nutrition/external/usda')
    const hit = usdaSearchCheddar.foods[0]!
    const food = usdaHitToExternal(hit)
    expect(food.source).toBe('usda')
    expect(food.externalId).toBe('2057648')
    expect(food.barcode).toBe('094395000172')
    expect(food.brand).toBe('Grafton Village Cheese Co, LLC')
    expect(typeof food.per100g!.energy).toBe('number')
    expect(typeof food.per100g!.protein).toBe('number')
    expect(food.per100g!.energy).toBe(393)
    expect(food.per100g!.protein).toBe(21.4)
    expect(food.per100g!.fat).toBe(28.6)
    expect(food.per100g!.carbohydrate).toBe(3.57)
    expect(food.per100g!.sugar).toBe(0)
    expect(food.per100g!.fiber).toBe(0)
    expect(food.per100g!.sodium).toBe(679)
    expect(food.per100g!.cholesterol).toBe(89)
    expect(food.per100g!.saturatedFat).toBe(21.4)
    expect(food.per100g).not.toHaveProperty('potassium')
  })

  it('sets servingGrams from servingSize only when servingSizeUnit is g', async () => {
    const { usdaHitToExternal } = await import('../../server/utils/nutrition/external/usda')
    const hit = usdaSearchCheddar.foods[0]!
    const food = usdaHitToExternal(hit)
    expect(food.servingGrams).toBe(28)
  })

  it('reports no servingGrams when servingSizeUnit is not g', async () => {
    const { usdaHitToExternal } = await import('../../server/utils/nutrition/external/usda')
    const hit = { ...usdaSearchCheddar.foods[0]!, servingSizeUnit: 'ml' }
    const food = usdaHitToExternal(hit)
    expect(food.servingGrams).toBeNull()
  })

  it('falls back to null barcode and brand when absent', async () => {
    const { usdaHitToExternal } = await import('../../server/utils/nutrition/external/usda')
    const food = usdaHitToExternal({ fdcId: 1, description: 'Mystery', foodNutrients: [] })
    expect(food.barcode).toBeNull()
    expect(food.brand).toBeNull()
    expect(food.per100g).toEqual({})
  })

  it('skips a mapped nutrient whose unit does not match the expected unit', async () => {
    const { usdaHitToExternal } = await import('../../server/utils/nutrition/external/usda')
    const food = usdaHitToExternal({
      fdcId: 1,
      description: 'Weird units',
      foodNutrients: [{ nutrientNumber: '208', nutrientName: 'Energy', unitName: 'KJ', value: 100 }]
    })
    expect(food.per100g).not.toHaveProperty('energy')
  })
})

describe('usdaHitToExternal from a detail food', () => {
  it('maps foodNutrients (nutrient.number/amount shape) and ignores labelNutrients', async () => {
    const { usdaHitToExternal } = await import('../../server/utils/nutrition/external/usda')
    const food = usdaHitToExternal(usdaFoodDetail)
    expect(food.per100g!.energy).toBe(393)
    expect(food.per100g!.protein).toBe(21.43)
    expect(food.per100g!.sodium).toBe(679)
    expect(food.per100g!.cholesterol).toBe(89)
  })
})

describe('usdaSearch', () => {
  it('throws unconfigured when the api key is empty', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: '' } }))
    const { usdaSearch } = await import('../../server/utils/nutrition/external/usda')
    await expect(usdaSearch('cheddar cheese', 3)).rejects.toMatchObject({
      name: 'ExternalSourceError', source: 'usda', kind: 'unconfigured'
    })
  })

  it('sends the api key and query, returning mapped foods', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(usdaSearchCheddar), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { usdaSearch } = await import('../../server/utils/nutrition/external/usda')
    const foods = await usdaSearch('cheddar cheese', 3)
    expect(foods).toHaveLength(3)
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain('api_key=k')
    expect(url).toContain('query=cheddar%20cheese')
    expect(url).toContain('pageSize=3')
  })

  it('maps HTTP 429 to a rate_limited ExternalSourceError', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('too many requests', { status: 429 })))
    const { usdaSearch } = await import('../../server/utils/nutrition/external/usda')
    await expect(usdaSearch('cheddar cheese', 3)).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'rate_limited' })
  })

  it('maps an aborted request to an unavailable ExternalSourceError', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    const { usdaSearch } = await import('../../server/utils/nutrition/external/usda')
    await expect(usdaSearch('cheddar cheese', 3)).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'unavailable' })
  })
})

describe('usdaById', () => {
  it('fetches by fdcId and maps the detail shape', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(usdaFoodDetail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { usdaById } = await import('../../server/utils/nutrition/external/usda')
    const food = await usdaById('2057648')
    expect(food!.externalId).toBe('2057648')
    expect(food!.per100g!.energy).toBe(393)
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toContain('/food/2057648')
    expect(url).toContain('api_key=k')
  })

  it('returns null on an HTTP 404', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))
    const { usdaById } = await import('../../server/utils/nutrition/external/usda')
    expect(await usdaById('0')).toBeNull()
  })
})

describe('usdaByUpc', () => {
  it('finds the hit whose gtinUpc matches after stripping leading zeros', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(usdaSearchCheddar), { status: 200 })))
    const { usdaByUpc } = await import('../../server/utils/nutrition/external/usda')
    const food = await usdaByUpc('94395000172')
    expect(food!.externalId).toBe('2057648')
  })

  it('returns null when no hit matches the code', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ usda: { apiKey: 'k' } }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(usdaSearchCheddar), { status: 200 })))
    const { usdaByUpc } = await import('../../server/utils/nutrition/external/usda')
    expect(await usdaByUpc('000000000000')).toBeNull()
  })
})
