import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aggregateExternalResults,
  findFirstBarcodeMatch,
  getExternalSources
} from '../../server/utils/nutrition/external/registry'
import { offByBarcode } from '../../server/utils/nutrition/external/off'
import { ExternalSourceError } from '../../server/utils/nutrition/external/types'
import type { ExternalFood, ExternalSourceKey } from '../../server/utils/nutrition/external/types'

afterEach(() => {
  vi.unstubAllGlobals()
})

function food(overrides: Partial<ExternalFood> = {}): ExternalFood {
  return {
    source: 'off',
    externalId: '1',
    name: 'Food',
    brand: null,
    barcode: null,
    per100g: { energy: 100 },
    servingGrams: null,
    servingLabel: null,
    attribution: 'attr',
    ...overrides
  }
}

describe('getExternalSources', () => {
  it('includes only configured sources, in off/usda/fatsecret order', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      off: { userAgent: 'ua' },
      usda: { apiKey: '' },
      fatsecret: { clientId: 'id', clientSecret: 'secret' }
    }))
    expect(getExternalSources().map((s) => s.key)).toEqual(['off', 'fatsecret'])
  })

  it('excludes fatsecret when only one of the two credentials is set', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      off: { userAgent: '' },
      usda: { apiKey: 'key' },
      fatsecret: { clientId: 'id', clientSecret: '' }
    }))
    expect(getExternalSources().map((s) => s.key)).toEqual(['usda'])
  })

  it('uses offByBarcode as byId, since OFF externalId is the barcode', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      off: { userAgent: 'ua' },
      usda: { apiKey: '' },
      fatsecret: { clientId: '', clientSecret: '' }
    }))
    const off = getExternalSources().find((s) => s.key === 'off')!
    expect(off.byId).toBe(offByBarcode)
  })
})

describe('aggregateExternalResults', () => {
  it('maps a fulfilled source to results with hasNutrition true when per100g has keys', () => {
    const { results, errors } = aggregateExternalResults([
      { source: 'off', result: { status: 'fulfilled', value: [food({ per100g: { energy: 10 } })] } }
    ])
    expect(errors).toEqual([])
    expect(results).toEqual([expect.objectContaining({ source: 'off', hasNutrition: true })])
  })

  it('reports hasNutrition false when per100g is null or empty', () => {
    const { results } = aggregateExternalResults([
      {
        source: 'usda',
        result: {
          status: 'fulfilled',
          value: [food({ source: 'usda', per100g: null }), food({ source: 'usda', externalId: '2', per100g: {} })]
        }
      }
    ])
    expect(results.map((r) => r.hasNutrition)).toEqual([false, false])
  })

  it('turns a rejected ExternalSourceError into a typed error entry', () => {
    const err = new ExternalSourceError('usda', 'rate_limited', 'too many requests')
    const { results, errors } = aggregateExternalResults([{ source: 'usda', result: { status: 'rejected', reason: err } }])
    expect(results).toEqual([])
    expect(errors).toEqual([{ source: 'usda', kind: 'rate_limited', message: 'too many requests' }])
  })

  it('maps a rejected plain Error to kind unavailable', () => {
    const { errors } = aggregateExternalResults([
      { source: 'fatsecret', result: { status: 'rejected', reason: new Error('boom') } }
    ])
    expect(errors).toEqual([{ source: 'fatsecret', kind: 'unavailable', message: 'boom' }])
  })
})

describe('findFirstBarcodeMatch', () => {
  function source(key: ExternalSourceKey, byBarcode: (code: string) => Promise<ExternalFood | null>) {
    return { key, search: vi.fn(), byId: vi.fn(), byBarcode }
  }

  it('tolerates a thrown ExternalSourceError, collects it, and keeps trying later sources', async () => {
    const hit = food({ source: 'fatsecret', externalId: '9' })
    const sources = [
      source('off', () => Promise.reject(new ExternalSourceError('off', 'unavailable', 'down'))),
      source('usda', () => Promise.resolve(null)),
      source('fatsecret', () => Promise.resolve(hit))
    ]
    const result = await findFirstBarcodeMatch(sources, '3017624010701')
    expect(result).toEqual({
      match: hit,
      source: 'fatsecret',
      errors: [{ source: 'off', kind: 'unavailable', message: 'down' }]
    })
  })

  it('returns a null match with the collected errors when every source misses or fails', async () => {
    const sources = [
      source('off', () => Promise.resolve(null)),
      source('fatsecret', () => Promise.reject(new ExternalSourceError('fatsecret', 'unavailable', 'Invalid IP')))
    ]
    const result = await findFirstBarcodeMatch(sources, '0000000000000')
    expect(result).toEqual({
      match: null,
      source: null,
      errors: [{ source: 'fatsecret', kind: 'unavailable', message: 'Invalid IP' }]
    })
  })

  it('rethrows an error that is not an ExternalSourceError', async () => {
    const sources = [source('off', () => Promise.reject(new Error('unexpected')))]
    await expect(findFirstBarcodeMatch(sources, '0000000000000')).rejects.toThrow('unexpected')
  })
})
