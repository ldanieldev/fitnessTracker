import { describe, expect, it, vi, beforeEach } from 'vitest'

describe('coalesceOutbox', () => {
  it('keeps the last op per entity in id order', async () => {
    const { coalesceOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')
    const rows = [
      { id: 1, entityId: 7, op: 'upsert' as const },
      { id: 2, entityId: 8, op: 'upsert' as const },
      { id: 3, entityId: 7, op: 'delete' as const }
    ]
    expect(coalesceOutbox(rows)).toEqual([{ entityId: 8, op: 'upsert' }, { entityId: 7, op: 'delete' }])
  })

  it('collapses repeated upserts to one', async () => {
    const { coalesceOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')
    const rows = [1, 2, 3].map((id) => ({ id, entityId: 5, op: 'upsert' as const }))
    expect(coalesceOutbox(rows)).toEqual([{ entityId: 5, op: 'upsert' }])
  })

  it('returns an empty plan for no rows', async () => {
    const { coalesceOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')
    expect(coalesceOutbox([])).toEqual([])
  })
})

const isEmpty = vi.fn(async () => false)
const index = vi.fn()
const del = vi.fn()
const rebuild = vi.fn()
const select = vi.fn()
const update = vi.fn()

vi.mock('../../server/utils/db', () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args)
  }
}))

class FakeMeiliSearchProvider {
  isEmpty = isEmpty
  index = index
  delete = del
  rebuild = rebuild
}

vi.mock('../../server/utils/nutrition/meiliSearch', () => ({ MeiliSearchProvider: FakeMeiliSearchProvider }))

const fakeProvider = new FakeMeiliSearchProvider()

vi.mock('../../server/utils/nutrition/searchProvider', () => ({
  getSearchProvider: vi.fn(async () => fakeProvider),
  isDegradedProvider: vi.fn(() => false)
}))

function stubSelectResult(rows: unknown[]) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows
  }
  select.mockReturnValueOnce(chain)
}

function stubUpdateResult() {
  const chain = { set: () => chain, where: async () => undefined }
  update.mockReturnValueOnce(chain)
}

describe('drainSearchOutbox per-item isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isEmpty.mockResolvedValue(false)
  })

  it('leaves a failing entity unprocessed while marking the rest processed', async () => {
    const { drainSearchOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')

    index.mockImplementation(async (foodId: number) => {
      if (foodId === 7) throw new Error('meili down for 7')
    })

    stubSelectResult([
      { id: 1, entityId: 7, op: 'upsert' },
      { id: 2, entityId: 8, op: 'upsert' }
    ])
    stubUpdateResult()

    const result = await drainSearchOutbox()

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.rebuilt).toBe(false)
    expect(update).toHaveBeenCalledTimes(1)
    expect(index).toHaveBeenCalledWith(7)
    expect(index).toHaveBeenCalledWith(8)
  })

  it('leaves every row of a multi-row failing entity unprocessed, marking only the other entity', async () => {
    const { drainSearchOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')

    del.mockImplementation(async (foodId: number) => {
      if (foodId === 7) throw new Error('meili down for 7')
    })

    stubSelectResult([
      { id: 1, entityId: 7, op: 'upsert' },
      { id: 2, entityId: 8, op: 'upsert' },
      { id: 3, entityId: 7, op: 'delete' }
    ])
    stubUpdateResult()

    const result = await drainSearchOutbox()

    expect(result.processed).toBe(1)
    expect(result.failed).toBe(1)
    expect(index).toHaveBeenCalledWith(8)
    expect(index).not.toHaveBeenCalledWith(7)
    expect(del).toHaveBeenCalledWith(7)
  })

  it('rebuilds first when the index is empty, then still drains the batch', async () => {
    const { drainSearchOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')

    isEmpty.mockResolvedValueOnce(true)
    stubSelectResult([{ id: 1, entityId: 8, op: 'upsert' }])
    stubUpdateResult()

    const result = await drainSearchOutbox()

    expect(rebuild).toHaveBeenCalledTimes(1)
    expect(result.rebuilt).toBe(true)
    expect(result.processed).toBe(1)
    expect(result.failed).toBe(0)
  })

  it('skips when the provider is degraded', async () => {
    const { drainSearchOutbox } = await import('../../server/utils/nutrition/searchOutboxDrain')
    const { isDegradedProvider } = await import('../../server/utils/nutrition/searchProvider')
    vi.mocked(isDegradedProvider).mockReturnValueOnce(true)

    const result = await drainSearchOutbox()

    expect(result).toEqual({ processed: 0, failed: 0, skipped: true, rebuilt: false })
    expect(select).not.toHaveBeenCalled()
  })
})
