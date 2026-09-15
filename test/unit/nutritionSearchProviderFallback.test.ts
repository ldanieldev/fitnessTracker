import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const healthy = vi.fn()

class FakeMeiliSearchProvider {
  healthy = healthy
  query = vi.fn()
  index = vi.fn()
  delete = vi.fn()
  rebuild = vi.fn()
}

vi.mock('../../server/utils/nutrition/meiliSearch', () => ({ MeiliSearchProvider: FakeMeiliSearchProvider }))

const { getSearchProvider, markSearchUnhealthy, getFallbackProvider, isDegradedProvider } = await import(
  '../../server/utils/nutrition/searchProvider'
)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ meili: { host: 'http://localhost:7700', apiKey: '' } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('markSearchUnhealthy', () => {
  it('forces the next getSearchProvider call to re-probe and fall back when the probe fails', async () => {
    healthy.mockResolvedValueOnce(true)
    const first = await getSearchProvider()
    expect(isDegradedProvider(first)).toBe(false)

    markSearchUnhealthy()
    healthy.mockResolvedValueOnce(false)
    const second = await getSearchProvider()

    expect(healthy).toHaveBeenCalledTimes(2)
    expect(isDegradedProvider(second)).toBe(true)
    expect(second).toBe(getFallbackProvider())
  })
})
