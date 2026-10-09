import { beforeEach, describe, expect, it, vi } from 'vitest'

const health = vi.fn()
const createIndex = vi.fn()
const updateSettings = vi.fn()
const search = vi.fn()
const index = vi.fn((_name: string) => ({ updateSettings, search }))

vi.mock('meilisearch', () => ({
  Meilisearch: vi.fn().mockImplementation(function () {
    return { health, createIndex, index }
  })
}))

const { MeiliIndexProvider } = await import('../../server/utils/search/meiliIndex')
const { MeiliSearchProvider } = await import('../../server/utils/nutrition/meiliSearch')
const { ExerciseMeiliProvider } = await import('../../server/utils/workouts/meiliSearch')

beforeEach(() => {
  vi.clearAllMocks()
  health.mockResolvedValue({ status: 'available' })
  createIndex.mockResolvedValue(undefined)
  updateSettings.mockResolvedValue(undefined)
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
