import { describe, expect, it, vi, afterEach } from 'vitest'
import offProduct from '../fixtures/external/off-product-3017624010701.json'
import offSearchNutella from '../fixtures/external/off-search-nutella.json'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('offProductToExternal', () => {
  it('maps a product with nutriments, converting sodium from grams to mg', async () => {
    const { offProductToExternal } = await import('../../server/utils/nutrition/external/off')
    const food = offProductToExternal(offProduct.product)
    expect(food.name).toBe('Nutella')
    expect(food.barcode).toBe('3017624010701')
    expect(typeof food.per100g!.energy).toBe('number')
    expect(food.per100g!.sodium).toBeCloseTo(43, 5)
    expect(food.per100g!.saturatedFat).toBe(10.6)
    expect(food.per100g!.sugar).toBe(56.3)
    expect(food.per100g).not.toHaveProperty('fiber')
  })

  it('reports no nutrition when the product has no nutriments', async () => {
    const { offProductToExternal } = await import('../../server/utils/nutrition/external/off')
    const food = offProductToExternal({ code: '123', product_name: 'Mystery' })
    expect(food.per100g).toBeNull()
  })

  it('derives sodium from salt when sodium_100g is absent', async () => {
    const { offProductToExternal } = await import('../../server/utils/nutrition/external/off')
    const food = offProductToExternal({ code: '1', product_name: 'Salty', nutriments: { salt_100g: 0.5 } })
    expect(food.per100g!.sodium).toBeCloseTo(200, 5)
  })
})

describe('offHitsToExternal', () => {
  it('maps search hits to ExternalFood entries with barcodes', async () => {
    const { offHitsToExternal } = await import('../../server/utils/nutrition/external/off')
    const foods = offHitsToExternal(offSearchNutella.hits)
    expect(foods).toHaveLength(3)
    for (const food of foods) expect(food.barcode).toMatch(/^\d+$/)
  })

  it('drops hits missing a code or a product_name', async () => {
    const { offHitsToExternal } = await import('../../server/utils/nutrition/external/off')
    const foods = offHitsToExternal([
      { code: '111', product_name: 'Complete' },
      { code: '222' },
      { code: '', product_name: 'No code' }
    ])
    expect(foods).toHaveLength(1)
    expect(foods[0]!.name).toBe('Complete')
  })
})

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'
const SEARCH_URL = 'https://search.openfoodfacts.org/search'

function stubOffConfig(overrides: Partial<{ productUrl: string, searchUrl: string }> = {}) {
  vi.stubGlobal('useRuntimeConfig', () => ({
    off: { userAgent: 'Test/1.0 (a@b.com)', productUrl: PRODUCT_URL, searchUrl: SEARCH_URL, ...overrides }
  }))
}

function fetchError(status: number | undefined, cause?: Error) {
  return Object.assign(new Error(`HTTP ${status}`), { name: 'FetchError', status, cause })
}

describe('offByBarcode', () => {
  it('throws unconfigured when the user agent is empty', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ off: { userAgent: '' } }))
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    await expect(offByBarcode('3017624010701')).rejects.toMatchObject({
      name: 'ExternalSourceError', source: 'off', kind: 'unconfigured'
    })
  })

  it('sends the configured User-Agent and returns the mapped product', async () => {
    stubOffConfig()
    const fetchMock = vi.fn().mockResolvedValue(offProduct)
    vi.stubGlobal('$fetch', fetchMock)
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    const food = await offByBarcode('3017624010701')
    expect(food!.name).toBe('Nutella')
    const [, init] = fetchMock.mock.calls[0]!
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('Test/1.0 (a@b.com)')
  })

  it('builds its request URL from the configured productUrl', async () => {
    stubOffConfig({ productUrl: '/api/nutrition/_test/off/product' })
    const fetchMock = vi.fn().mockResolvedValue(offProduct)
    vi.stubGlobal('$fetch', fetchMock)
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    await offByBarcode('3017624010701')
    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/nutrition/_test/off/product/3017624010701.json?fields=code,product_name,brands,serving_size,nutriments')
  })

  it('returns null when OFF reports status 0 (not found)', async () => {
    stubOffConfig()
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ status: 0, status_verbose: 'product not found' }))
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    expect(await offByBarcode('0')).toBeNull()
  })

  it('returns null on an HTTP 404', async () => {
    stubOffConfig()
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(404)))
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    expect(await offByBarcode('0')).toBeNull()
  })

  it('maps HTTP 429 to a rate_limited ExternalSourceError', async () => {
    stubOffConfig()
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(429)))
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    await expect(offByBarcode('0')).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'rate_limited' })
  })

  it('maps a network failure to an unavailable ExternalSourceError', async () => {
    stubOffConfig()
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(undefined, new Error('network down'))))
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    await expect(offByBarcode('0')).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'unavailable' })
  })

  it('maps an aborted request to an unavailable ExternalSourceError', async () => {
    stubOffConfig()
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(fetchError(undefined, abortErr)))
    const { offByBarcode } = await import('../../server/utils/nutrition/external/off')
    await expect(offByBarcode('0')).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'unavailable' })
  })
})

describe('offSearch', () => {
  it('sends the configured User-Agent and returns mapped foods for a search query', async () => {
    stubOffConfig()
    const fetchMock = vi.fn().mockResolvedValue(offSearchNutella)
    vi.stubGlobal('$fetch', fetchMock)
    const { offSearch } = await import('../../server/utils/nutrition/external/off')
    const foods = await offSearch('nutella', 3)
    expect(foods).toHaveLength(3)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toContain('q=nutella')
    expect(url).toContain('page_size=3')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('Test/1.0 (a@b.com)')
  })
})

describe('fetchJson', () => {
  // Real 20 ms timeout rather than fake timers: AbortController's own timer must fire and its
  // abort event must propagate through the stub, which vi.useFakeTimers() would freeze too.
  it('rejects with AbortError when the request exceeds the timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    })))
    const { fetchJson } = await import('../../server/utils/nutrition/external/http')
    await expect(fetchJson('http://example.com', {}, 20)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
