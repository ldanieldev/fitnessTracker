import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const healthy = vi.fn()
const warn = vi.fn()
const info = vi.fn()

vi.mock('../../server/utils/logger', () => {
  const log = { warn: (...a: unknown[]) => warn(...a), info: (...a: unknown[]) => info(...a) }
  return { logger: { ...log, child: () => log } }
})

class FakeMeiliSearchProvider {
  probe = async () => ((await healthy()) ? { healthy: true } : { healthy: false, reason: 'not_available' })
  query = vi.fn()
  index = vi.fn()
  delete = vi.fn()
  rebuild = vi.fn()
}

vi.mock('../../server/utils/nutrition/meiliSearch', () => ({ MeiliSearchProvider: FakeMeiliSearchProvider }))

const { getSearchProvider, markSearchUnhealthy, getFallbackProvider, isDegradedProvider } =
  await import('../../server/utils/nutrition/searchProvider')

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({ meili: { host: 'http://localhost:7700', apiKey: '' } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('markSearchUnhealthy', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('serves the fallback without probing for 30 s, then re-probes', async () => {
    vi.useFakeTimers()
    healthy.mockResolvedValueOnce(true)
    const first = await getSearchProvider()
    expect(isDegradedProvider(first)).toBe(false)

    markSearchUnhealthy()
    const second = await getSearchProvider()
    expect(healthy).toHaveBeenCalledTimes(1)
    expect(second).toBe(getFallbackProvider())

    vi.advanceTimersByTime(30_001)
    healthy.mockResolvedValueOnce(true)
    expect(isDegradedProvider(await getSearchProvider())).toBe(false)
    expect(healthy).toHaveBeenCalledTimes(2)
  })

  it('caches a failed probe for 30 s instead of probing on every request', async () => {
    vi.useFakeTimers()
    vi.advanceTimersByTime(120_000)
    healthy.mockResolvedValue(false)
    expect(isDegradedProvider(await getSearchProvider())).toBe(true)
    expect(isDegradedProvider(await getSearchProvider())).toBe(true)
    expect(healthy).toHaveBeenCalledTimes(1)
  })
})

describe('Meilisearch health logging', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('warns once on the healthy -> unhealthy flip and logs info once on recovery', async () => {
    vi.useFakeTimers()
    vi.advanceTimersByTime(600_000)
    healthy.mockResolvedValue(true)
    await getSearchProvider()
    info.mockClear()

    markSearchUnhealthy(new Error('connect ECONNREFUSED'))
    markSearchUnhealthy(new Error('connect ECONNREFUSED'))
    vi.advanceTimersByTime(30_001)
    healthy.mockResolvedValue(false)
    await getSearchProvider()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]![0]).toMatchObject({ index: 'foods', reason: 'query_failed' })
    expect(warn.mock.calls[0]![1]).toContain('Postgres')

    vi.advanceTimersByTime(30_001)
    healthy.mockResolvedValue(true)
    await getSearchProvider()
    vi.advanceTimersByTime(30_001)
    await getSearchProvider()
    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith({ index: 'foods' }, expect.any(String))
  })
})
