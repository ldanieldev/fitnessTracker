import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExternalFood, ExternalSourceKey } from '../../server/utils/nutrition/external/types'

interface CacheEntry { value: unknown }

function fakeDefineCachedFunction(fn: (...args: unknown[]) => Promise<unknown>, opts: { getKey: (...args: unknown[]) => string }) {
  const store = new Map<string, CacheEntry>()
  return async (...args: unknown[]) => {
    const key = opts.getKey(...args)
    const hit = store.get(key)
    if (hit) return hit.value
    const value = await fn(...args)
    store.set(key, { value })
    return value
  }
}

function food(source: ExternalSourceKey, id: string): ExternalFood {
  return {
    source, externalId: id, name: 'Food', brand: null, barcode: null, per100g: null,
    servingGrams: null, servingLabel: null, attribution: null
  }
}

function makeSource(key: ExternalSourceKey) {
  return {
    key,
    search: vi.fn(async (_q: string, _limit: number) => [food(key, '1')]),
    byBarcode: vi.fn(async (_code: string) => food(key, '1')),
    byId: vi.fn()
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('defineCachedFunction', fakeDefineCachedFunction)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cachedSearch', () => {
  it('hits the source once for two identical searches', async () => {
    const { cachedSearch } = await import('../../server/utils/nutrition/external/cache')
    const source = makeSource('off')
    await cachedSearch(source, 'Chicken', 10)
    await cachedSearch(source, ' chicken ', 10)
    expect(source.search).toHaveBeenCalledTimes(1)
  })

  it('does not cache a rejected search — the next call hits the source again', async () => {
    const { cachedSearch } = await import('../../server/utils/nutrition/external/cache')
    const source = makeSource('off')
    source.search.mockRejectedValueOnce(new Error('down'))
    await expect(cachedSearch(source, 'chicken', 10)).rejects.toThrow('down')
    await cachedSearch(source, 'chicken', 10)
    expect(source.search).toHaveBeenCalledTimes(2)
  })
})

describe('cachedBarcode', () => {
  it('keys the cache per source, so two sources are queried independently for the same code', async () => {
    const { cachedBarcode } = await import('../../server/utils/nutrition/external/cache')
    const off = makeSource('off')
    const usda = makeSource('usda')
    await cachedBarcode(off, '0000000000000')
    await cachedBarcode(usda, '0000000000000')
    await cachedBarcode(off, '0000000000000')
    expect(off.byBarcode).toHaveBeenCalledTimes(1)
    expect(usda.byBarcode).toHaveBeenCalledTimes(1)
  })
})
