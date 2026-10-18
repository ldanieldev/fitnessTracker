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
const getTasks = vi.fn()
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
  return { health, createIndex, getRawIndex, deleteIndex, index, tasks: { getTasks } }
})
vi.mock('meilisearch', () => ({ Meilisearch, MeilisearchApiError }))

const warn = vi.fn()
const info = vi.fn()
vi.mock('../../server/utils/logger', () => {
  const log = { warn: (...a: unknown[]) => warn(...a), info: (...a: unknown[]) => info(...a) }
  return { logger: { ...log, child: () => log } }
})

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
  getStats.mockResolvedValue({ numberOfDocuments: 1 })
  getTasks.mockResolvedValue({ results: [], total: 0 })
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
    expect(deleteIndex).not.toHaveBeenCalled()
    expect(createIndex).toHaveBeenCalledTimes(2)
    expect(updateSettings).toHaveBeenCalledTimes(2)
    await vi.waitFor(async () => expect(await provider.healthy()).toBe(true))
    expect(createIndex).toHaveBeenCalledTimes(2)
  })

  it('adopts an index another process recreated without deleting it, re-applying settings', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    vi.spyOn(provider as never, 'loadAllDocuments').mockResolvedValue([{ id: 1 }] as never)
    getStats.mockResolvedValue({ numberOfDocuments: 5 })
    expect(await provider.healthy()).toBe(true)

    getRawIndex.mockResolvedValue({ createdAt: '2026-10-02T00:00:00Z' })
    expect(await provider.healthy()).toBe(true)
    expect(await provider.healthy()).toBe(true)
    expect(deleteIndex).not.toHaveBeenCalled()
    expect(deleteAllDocuments).not.toHaveBeenCalled()
    expect(updateSettings).toHaveBeenCalledTimes(2)
  })

  it('rebuilds a recreated index only when it is empty', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    vi.spyOn(provider as never, 'loadAllDocuments').mockResolvedValue([{ id: 1 }] as never)
    getStats.mockResolvedValue({ numberOfDocuments: 5 })
    expect(await provider.healthy()).toBe(true)

    getRawIndex.mockResolvedValue({ createdAt: '2026-10-02T00:00:00Z' })
    getStats.mockResolvedValueOnce({ numberOfDocuments: 0 })
    expect(await provider.healthy()).toBe(false)
    await vi.waitFor(() => expect(addDocuments).toHaveBeenCalledWith([{ id: 1 }], { primaryKey: 'id' }))
    expect(deleteIndex).not.toHaveBeenCalled()
    await vi.waitFor(async () => expect(await provider.healthy()).toBe(true))
  })

  it('treats a missing index as empty but any other stats failure as not known empty', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    getStats.mockRejectedValueOnce(new MeilisearchApiError('index_not_found'))
    expect(await provider.isEmpty()).toBe(true)
    getStats.mockRejectedValueOnce(new Error('timeout'))
    expect(await provider.isEmpty()).toBe(false)
  })

  it('treats a zero-document index with a queued rebuild as not empty', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    getStats.mockResolvedValue({ numberOfDocuments: 0 })
    getTasks.mockResolvedValueOnce({ results: [{ uid: 1 }], total: 1 })
    expect(await provider.isEmpty()).toBe(false)
    expect(getTasks).toHaveBeenCalledWith({
      indexUids: ['exercises'],
      statuses: ['enqueued', 'processing'],
      types: ['documentDeletion', 'documentAdditionOrUpdate'],
      limit: 1
    })
    expect(await provider.isEmpty()).toBe(true)
  })
})

describe('MeiliIndexProvider logging', () => {
  const failedTask = (errorCode: string) => () =>
    Object.assign(Promise.resolve({}), {
      waitTask: () => Promise.resolve({ status: 'failed', error: { code: errorCode } })
    })

  it('stays quiet when the index already exists', async () => {
    createIndex.mockImplementation(failedTask('index_already_exists'))
    await new ExerciseMeiliProvider('http://localhost:7700', '').ensureIndex()
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when the create task fails for another reason', async () => {
    createIndex.mockImplementation(failedTask('invalid_api_key'))
    await new ExerciseMeiliProvider('http://localhost:7700', '').ensureIndex()
    expect(warn).toHaveBeenCalledWith({ index: 'exercises', errorCode: 'invalid_api_key' }, expect.any(String))
  })

  it('warns when the create request itself fails', async () => {
    createIndex.mockImplementation(() => ({ waitTask: () => Promise.reject(new Error('fetch failed')) }))
    await new ExerciseMeiliProvider('http://localhost:7700', '').ensureIndex()
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'exercises', err: expect.objectContaining({ message: 'fetch failed' }) }),
      expect.any(String)
    )
  })

  it('probes with a reason when unhealthy', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    health.mockResolvedValueOnce({ status: 'unavailable' })
    expect(await provider.probe()).toEqual({ healthy: false, reason: 'not_available' })
    health.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    expect(await provider.probe()).toMatchObject({ healthy: false, reason: 'request_failed', err: { type: 'Error' } })
  })

  it('logs the rebuild with document count and task uids', async () => {
    const provider = new ExerciseMeiliProvider('http://localhost:7700', '')
    vi.spyOn(provider as never, 'loadAllDocuments').mockResolvedValue([{ id: 1 }, { id: 2 }] as never)
    deleteAllDocuments.mockImplementation(() => Object.assign(Promise.resolve({ taskUid: 7 }), { waitTask: enqueued }))
    addDocuments.mockImplementation(() => Object.assign(Promise.resolve({ taskUid: 8 }), { waitTask: enqueued }))
    await provider.rebuild()
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ index: 'exercises', docs: 2, deleteTaskUid: 7, addTaskUid: 8 }),
      expect.any(String)
    )
  })

  it('summarises a timeout without the request body it carries', async () => {
    const { meiliErrorSummary } = await import('../../server/utils/search/meiliIndex')
    const timeout = Object.assign(new Error('request timed out after 1500ms'), {
      cause: { requestInit: { body: '{"q":"grandma soup"}' } }
    })
    const summary = meiliErrorSummary(new Error('Request to http://m/indexes/foods/search has failed', { cause: timeout }))
    expect(JSON.stringify(summary)).not.toContain('grandma')
    expect(summary.cause).toContain('timed out')
  })
})
