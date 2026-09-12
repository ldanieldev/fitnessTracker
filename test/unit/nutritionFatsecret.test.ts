import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const config = { fatsecret: { clientId: 'id', clientSecret: 'secret', scope: 'basic' } }

function fakeStorage() {
  const store = new Map<string, unknown>()
  return {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: unknown) => {
      store.set(key, value)
    }
  }
}

beforeEach(() => {
  vi.resetModules()
  const storage = fakeStorage()
  vi.stubGlobal('useStorage', () => storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('getFatsecretToken', () => {
  it('caches the token until 60s before expiry, then refetches', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getFatsecretToken } = await import('../../server/utils/nutrition/external/fatsecret')

    await getFatsecretToken()
    await getFatsecretToken()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(86400 * 1000 - 60 * 1000 + 1)
    await getFatsecretToken()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one in-flight request across concurrent callers', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getFatsecretToken } = await import('../../server/utils/nutrition/external/fatsecret')

    const [t1, t2] = await Promise.all([getFatsecretToken(), getFatsecretToken()])
    expect(t1).toBe('t1')
    expect(t2).toBe('t1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends Basic auth of clientId:clientSecret and the configured scope', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { getFatsecretToken } = await import('../../server/utils/nutrition/external/fatsecret')
    await getFatsecretToken()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://oauth.fatsecret.com/connect/token')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${Buffer.from('id:secret').toString('base64')}`)
    expect(init.body).toBe('grant_type=client_credentials&scope=basic')
  })

  it('throws unconfigured when credentials are empty', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ fatsecret: { clientId: '', clientSecret: '', scope: 'basic' } }))
    const { getFatsecretToken } = await import('../../server/utils/nutrition/external/fatsecret')
    await expect(getFatsecretToken()).rejects.toMatchObject({
      name: 'ExternalSourceError', source: 'fatsecret', kind: 'unconfigured'
    })
  })
})

describe('fatsecretFoodToExternal', () => {
  const food = {
    food_id: '33691',
    food_name: 'Cheddar Cheese',
    brand_name: 'Test Brand',
    servings: {
      serving: [
        {
          serving_description: '1 slice',
          metric_serving_amount: '28.000',
          metric_serving_unit: 'g',
          calories: '110.000',
          protein: '6.000',
          carbohydrate: '1.000',
          fat: '8.000',
          fiber: '0.000',
          sugar: '0.000',
          saturated_fat: '6.000',
          cholesterol: '25.000',
          sodium: '190.000',
          potassium: '20.000',
          is_default: '1'
        },
        {
          serving_description: '100 g',
          metric_serving_amount: '100.000',
          metric_serving_unit: 'g',
          calories: '393.000',
          protein: '21.400',
          is_default: '0'
        }
      ]
    }
  }

  it('computes per100g from the default metric serving, scaled by 100 / amount', async () => {
    const { fatsecretFoodToExternal } = await import('../../server/utils/nutrition/external/fatsecret')
    const external = fatsecretFoodToExternal(food)
    expect(external.source).toBe('fatsecret')
    expect(external.externalId).toBe('33691')
    expect(external.brand).toBe('Test Brand')
    expect(external.servingGrams).toBe(28)
    expect(external.per100g!.energy).toBeCloseTo(392.86, 1)
    expect(external.per100g!.protein).toBeCloseTo(21.43, 1)
    expect(external.per100g!.sodium).toBeCloseTo(678.57, 1)
  })

  it('returns per100g null when the metric serving unit is not g', async () => {
    const { fatsecretFoodToExternal } = await import('../../server/utils/nutrition/external/fatsecret')
    const external = fatsecretFoodToExternal({
      food_id: '1',
      food_name: 'Liquid',
      servings: { serving: { metric_serving_amount: '240', metric_serving_unit: 'ml', calories: '100', is_default: '1' } }
    })
    expect(external.per100g).toBeNull()
    expect(external.servingGrams).toBeNull()
  })

  it('handles a food with no servings', async () => {
    const { fatsecretFoodToExternal } = await import('../../server/utils/nutrition/external/fatsecret')
    const external = fatsecretFoodToExternal({ food_id: '1', food_name: 'Empty' })
    expect(external.per100g).toBeNull()
    expect(external.servingGrams).toBeNull()
  })
})

describe('fatsecretById', () => {
  it('fetches a token then the food, mapping it to ExternalFood', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({
        food: { food_id: '33691', food_name: 'Cheddar', servings: { serving: { metric_serving_amount: '100', metric_serving_unit: 'g', calories: '393' } } }
      }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretById } = await import('../../server/utils/nutrition/external/fatsecret')
    const food = await fatsecretById('33691')
    expect(food!.externalId).toBe('33691')
    expect(food!.per100g!.energy).toBe(393)
  })

  it('returns null on an HTTP 404', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      return Promise.resolve(new Response('not found', { status: 404 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretById } = await import('../../server/utils/nutrition/external/fatsecret')
    expect(await fatsecretById('0')).toBeNull()
  })

  it('maps a 200 response carrying an {error} body to an unavailable ExternalSourceError', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { code: 21, message: 'Invalid IP address detected' } }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretById } = await import('../../server/utils/nutrition/external/fatsecret')
    await expect(fatsecretById('1')).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'unavailable' })
  })

  it('maps HTTP 429 to a rate_limited ExternalSourceError', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      return Promise.resolve(new Response('too many requests', { status: 429 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretById } = await import('../../server/utils/nutrition/external/fatsecret')
    await expect(fatsecretById('1')).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'rate_limited' })
  })

  it('throws unconfigured when credentials are empty', async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ fatsecret: { clientId: '', clientSecret: '', scope: 'basic' } }))
    const { fatsecretById } = await import('../../server/utils/nutrition/external/fatsecret')
    await expect(fatsecretById('1')).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'unconfigured' })
  })
})

describe('fatsecretSearch', () => {
  it('searches then fetches each hit, returning mapped foods', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      if (url.includes('method=foods.search')) {
        return Promise.resolve(new Response(JSON.stringify({
          foods: { food: [{ food_id: '1', food_name: 'A' }, { food_id: '2', food_name: 'B' }] }
        }), { status: 200 }))
      }
      const foodId = new URL(url).searchParams.get('food_id')
      return Promise.resolve(new Response(JSON.stringify({
        food: { food_id: foodId, food_name: `Food ${foodId}`, servings: { serving: { metric_serving_amount: '100', metric_serving_unit: 'g', calories: '100' } } }
      }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretSearch } = await import('../../server/utils/nutrition/external/fatsecret')
    const foods = await fatsecretSearch('cheddar', 3)
    expect(foods).toHaveLength(2)
    expect(foods.map((f) => f.externalId).sort()).toEqual(['1', '2'])
  })

  it('propagates a rate_limited ExternalSourceError from an underlying food.get.v4 call', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      if (url.includes('method=foods.search')) {
        return Promise.resolve(new Response(JSON.stringify({
          foods: { food: [{ food_id: '1', food_name: 'A' }] }
        }), { status: 200 }))
      }
      return Promise.resolve(new Response('too many requests', { status: 429 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretSearch } = await import('../../server/utils/nutrition/external/fatsecret')
    await expect(fatsecretSearch('x', 1)).rejects.toMatchObject({ name: 'ExternalSourceError', kind: 'rate_limited' })
  })
})

describe('fatsecretByBarcode', () => {
  it('pads a 12-digit UPC-A to 13 digits and resolves the food_id', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      if (url.includes('method=food.find_id_for_barcode')) {
        expect(url).toContain('barcode=0094395000172')
        return Promise.resolve(new Response(JSON.stringify({ food_id: { value: '33691' } }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({
        food: { food_id: '33691', food_name: 'Cheddar' }
      }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretByBarcode } = await import('../../server/utils/nutrition/external/fatsecret')
    const food = await fatsecretByBarcode('094395000172')
    expect(food!.externalId).toBe('33691')
  })

  it('returns null when food_id is 0', async () => {
    vi.stubGlobal('useRuntimeConfig', () => config)
    const fetchMock = vi.fn((url: string) => {
      if (url.startsWith('https://oauth.fatsecret.com')) {
        return Promise.resolve(new Response(JSON.stringify({ access_token: 't1', expires_in: 86400 }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ food_id: { value: '0' } }), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fatsecretByBarcode } = await import('../../server/utils/nutrition/external/fatsecret')
    expect(await fatsecretByBarcode('000000000000')).toBeNull()
  })
})
