import { beforeEach, describe, expect, it, vi } from 'vitest'

const health = vi.fn()
const createIndex = vi.fn()
const getRawIndex = vi.fn()
const deleteIndex = vi.fn()
const updateSettings = vi.fn()
const search = vi.fn()
const getStats = vi.fn()
const deleteAllDocuments = vi.fn()
const addDocuments = vi.fn()
const index = vi.fn((_name: string) => ({ updateSettings, search, getStats, deleteAllDocuments, addDocuments }))
const enqueued = () => Object.assign(Promise.resolve({}), { waitTask: () => Promise.resolve({}) })

class MeilisearchApiError extends Error {
  cause: { code: string }
  constructor(code: string) {
    super(code)
    this.cause = { code }
  }
}

const Meilisearch = vi.fn().mockImplementation(function () {
  return { health, createIndex, getRawIndex, deleteIndex, index }
})
vi.mock('meilisearch', () => ({ Meilisearch, MeilisearchApiError }))

const { MeiliIndexProvider } = await import('../../server/utils/search/meiliIndex')
const { MeiliSearchProvider } = await import('../../server/utils/nutrition/meiliSearch')
const { ExerciseMeiliProvider } = await import('../../server/utils/workouts/meiliSearch')

beforeEach(() => {
  vi.clearAllMocks()
  health.mockResolvedValue({ status: 'available' })
  createIndex.mockImplementation(enqueued)
  deleteIndex.mockImplementation(enqueued)
  getRawIndex.mockResolvedValue({ createdAt: '2026-10-01T00:00:00Z' })
  updateSettings.mockResolvedValue(undefined)
  deleteAllDocuments.mockImplementation(enqueued)
  addDocuments.mockImplementation(enqueued)
  search.mockResolvedValue({ hits: [{ id: '9', _rankingScore: 0.5 }] })
})

describe('MeiliIndexProvider', () => {
  it('backs both the food and the exercise provider', () => {
    expect(new MeiliSearchProvider('http://localhost:7700', '')).toBeInstanceOf(MeiliIndexProvider)
    expect(new ExerciseMeiliProvider('http://localhost:7700', '')).toBeInstanceOf(MeiliIndexProvider)
  })

  it('queries each provider\'s own index with its visibility filter', async () => {
    const hits = await new ExerciseMeiliProvider('http://localhost:7700', '').query(3, 'row', 5)
    expect(index).toHaveBeenLastCalledWith('exercises')
    expect(search).toHaveBeenLastCalledWith('row', {
      limit: 5,
      filter: 'is_catalog = true OR owner_id = 3',
      showRankingScore: true
    })
    expect(hits).toEqual([{ id: 9, relevance: 0.5 }])
    await new MeiliSearchProvider('http://localhost:7700', '').query(4, 'oats', 5)
    expect(index).toHaveBeenLastCalledWith('foods')
  })

  it('ensures the exercise index exactly once across two available probes', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    expect(await provider.healthy()).toBe(true)
    expect(await provider.healthy()).toBe(true)
    expect(createIndex).toHaveBeenCalledTimes(1)
    expect(createIndex).toHaveBeenCalledWith('exercises', { primaryKey: 'id' })
  })
})

describe('MeiliIndexProvider resilience', () => {
  it('gives reads a 1.5 s request timeout and bulk writes a longer one', () => {
    new ExerciseMeiliProvider('http://localhost:7700', '')
    const timeouts = Meilisearch.mock.calls.slice(-2).map(([options]) => (options as { timeout: number }).timeout)
    expect(timeouts.sort((a, b) => a - b)).toEqual([1500, 30_000])
  })

  it('recreates and rebuilds an index that went missing, degrading until it is back', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    vi.spyOn(provider as never, 'loadAllDocuments').mockResolvedValue([{ id: 1 }] as never)
    expect(await provider.healthy()).toBe(true)

    getRawIndex.mockRejectedValueOnce(new MeilisearchApiError('index_not_found'))
    getRawIndex.mockResolvedValue({ createdAt: '2026-10-02T00:00:00Z' })
    expect(await provider.healthy()).toBe(false)
    await vi.waitFor(() => expect(addDocuments).toHaveBeenCalledWith([{ id: 1 }], { primaryKey: 'id' }))
    expect(deleteIndex).toHaveBeenCalledWith('exercises')
    expect(createIndex).toHaveBeenCalledTimes(2)
    expect(updateSettings).toHaveBeenCalledTimes(2)
    await vi.waitFor(async () => expect(await provider.healthy()).toBe(true))
    expect(createIndex).toHaveBeenCalledTimes(2)
  })

  it('treats a missing index as empty but any other stats failure as not known empty', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    getStats.mockRejectedValueOnce(new MeilisearchApiError('index_not_found'))
    expect(await provider.isEmpty()).toBe(true)
    getStats.mockRejectedValueOnce(new Error('timeout'))
    expect(await provider.isEmpty()).toBe(false)
  })
})
