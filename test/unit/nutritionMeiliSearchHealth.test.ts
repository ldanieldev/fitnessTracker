import { describe, expect, it, vi, beforeEach } from 'vitest'

const health = vi.fn()
const createIndex = vi.fn()
const updateSettings = vi.fn()
const getStats = vi.fn()
const index = vi.fn(() => ({ updateSettings, getStats }))

const getRawIndex = vi.fn()

vi.mock('meilisearch', () => ({
  Meilisearch: vi.fn().mockImplementation(function () {
    return { health, createIndex, getRawIndex, index }
  }),
  MeilisearchApiError: class extends Error {}
}))

const { MeiliSearchProvider } = await import('../../server/utils/nutrition/meiliSearch')

beforeEach(() => {
  vi.clearAllMocks()
  health.mockResolvedValue({ status: 'available' })
  createIndex.mockImplementation(() => Object.assign(Promise.resolve({}), { waitTask: () => Promise.resolve({}) }))
  getRawIndex.mockResolvedValue({ createdAt: '2026-10-01T00:00:00Z' })
  updateSettings.mockResolvedValue(undefined)
})

describe('MeiliSearchProvider.healthy', () => {
  it('ensures the index exactly once across two available probes', async () => {
    const provider = new MeiliSearchProvider('http://localhost:7700', '')
    expect(await provider.healthy()).toBe(true)
    expect(await provider.healthy()).toBe(true)
    expect(createIndex).toHaveBeenCalledTimes(1)
    expect(updateSettings).toHaveBeenCalledTimes(1)
  })
})

describe('MeiliSearchProvider.isEmpty', () => {
  it('resolves false, not throwing, when getStats rejects', async () => {
    getStats.mockRejectedValueOnce(new Error('meili unreachable'))
    const provider = new MeiliSearchProvider('http://localhost:7700', '')
    await expect(provider.isEmpty()).resolves.toBe(false)
  })
})
