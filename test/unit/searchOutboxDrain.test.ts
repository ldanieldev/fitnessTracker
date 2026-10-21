import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const select = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const warn = vi.fn()
const error = vi.fn()
const info = vi.fn()

vi.mock('../../server/utils/db', () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args),
    delete: (...args: unknown[]) => remove(...args)
  }
}))

vi.mock('../../server/utils/logger', () => {
  const log = {
    warn: (...args: unknown[]) => warn(...args),
    error: (...args: unknown[]) => error(...args),
    info: (...args: unknown[]) => info(...args)
  }
  return { logger: { ...log, child: () => log } }
})

const dialect = new PgDialect()

function rendered(where: SQL) {
  return dialect.sqlToQuery(where)
}

const OUTBOX = [
  { id: 1, entity: 'food', entityId: 11, op: 'upsert' as const, attempts: 0 },
  { id: 2, entity: 'exercise', entityId: 22, op: 'upsert' as const, attempts: 0 },
  { id: 3, entity: 'exercise', entityId: 23, op: 'delete' as const, attempts: 0 },
  { id: 4, entity: 'food', entityId: 12, op: 'delete' as const, attempts: 9 }
]
let pruned: { attempts: number }[] = []

let selectWhere: SQL | undefined
let updateWhere: SQL | undefined
let updateSets: Record<string, unknown>[] = []
let deleteWhere: SQL | undefined

// The fake stands in for Postgres: it applies the drain's predicate, so a missing entity filter shows as extra rows.
function stubDb() {
  select.mockImplementation(() => {
    const chain = {
      from: () => chain,
      where: (where: SQL) => {
        selectWhere = where
        return chain
      },
      orderBy: () => chain,
      limit: async () => {
        const entity = rendered(selectWhere!).params[0]
        return OUTBOX.filter((row) => row.entity === entity).map(({ id, entityId, op, attempts }) => ({
          id,
          entityId,
          op,
          attempts
        }))
      }
    }
    return chain
  })
  update.mockImplementation(() => {
    const chain = {
      set: (values: Record<string, unknown>) => {
        updateSets.push(values)
        return chain
      },
      where: async (where: SQL) => {
        updateWhere = where
      }
    }
    return chain
  })
  remove.mockImplementation(() => ({
    where: (where: SQL) => {
      deleteWhere = where
      return { returning: async () => pruned }
    }
  }))
}

function fakeProvider() {
  return { index: vi.fn(async () => {}), delete: vi.fn(async () => {}), rebuild: vi.fn(async () => {}) }
}

describe('drainOutbox entity scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectWhere = undefined
    updateWhere = undefined
    deleteWhere = undefined
    updateSets = []
    pruned = []
    stubDb()
  })

  it('filters the batch to exercise rows and touches no food entity', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()

    const result = await drainOutbox('exercise', provider, {})

    expect(rendered(selectWhere!).sql).toContain('"entity" = $1')
    expect(rendered(selectWhere!).params).toEqual(['exercise', 10])
    expect(provider.index.mock.calls.flat()).toEqual([22])
    expect(provider.delete.mock.calls.flat()).toEqual([23])
    expect(rendered(updateWhere!).params).toEqual([2, 3])
    expect(result).toEqual({ processed: 2, failed: 0, skipped: false, rebuilt: false })
  })

  it('filters the batch to food rows and touches no exercise entity', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()

    const result = await drainOutbox('food', provider, {})

    expect(rendered(selectWhere!).params).toEqual(['food', 10])
    expect(provider.index.mock.calls.flat()).toEqual([11])
    expect(provider.delete.mock.calls.flat()).toEqual([12])
    expect(rendered(updateWhere!).params).toEqual([1, 4])
    expect(result.processed).toBe(2)
  })

  it('rebuilds only when the needsRebuild hook says so', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()

    expect((await drainOutbox('exercise', provider, { needsRebuild: async () => false })).rebuilt).toBe(false)
    expect(provider.rebuild).not.toHaveBeenCalled()

    expect((await drainOutbox('exercise', provider, { needsRebuild: async () => true })).rebuilt).toBe(true)
    expect(provider.rebuild).toHaveBeenCalledTimes(1)
  })

  it('skips rows that ran out of attempts', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    await drainOutbox('food', fakeProvider(), {})
    expect(rendered(selectWhere!).sql).toContain('"attempts" < $2')
  })

  it('counts a failed attempt on every row of the entity and logs it', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()
    provider.index.mockRejectedValueOnce(new Error('meili down'))

    const result = await drainOutbox('food', provider, {})

    expect(result).toMatchObject({ processed: 1, failed: 1 })
    expect(Object.keys(updateSets[1]!)).toEqual(['attempts'])
    expect(rendered(updateWhere!).params).toEqual([1])
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ entity: 'food', entityId: 11 }), expect.any(String))
  })

  it('warns for the first failed item, then once with the drain totals', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()
    provider.index.mockRejectedValueOnce(new Error('meili down'))
    provider.delete.mockRejectedValueOnce(new Error('meili down'))

    await drainOutbox('exercise', provider, {})

    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0]![0]).toMatchObject({ entity: 'exercise', entityId: 22, op: 'upsert' })
    expect(warn.mock.calls[1]![0]).toEqual({ entity: 'exercise', failed: 2, processed: 0 })
  })

  it('logs an error only when a failure uses up the last attempt', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()
    provider.index.mockRejectedValueOnce(new Error('meili down'))
    provider.delete.mockRejectedValueOnce(new Error('meili down'))

    await drainOutbox('food', provider, {})

    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith({ entity: 'food', entityId: 12, op: 'delete' }, expect.any(String))
  })

  it('keeps the request body of a timed-out Meilisearch call out of the warn', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()
    const timeout = Object.assign(new Error('request timed out'), {
      cause: { requestInit: { body: '{"name":"Grandma soup"}' } }
    })
    provider.index.mockRejectedValueOnce(new Error('Request to x has failed', { cause: timeout }))

    await drainOutbox('food', provider, {})

    expect(JSON.stringify(warn.mock.calls)).not.toContain('Grandma')
  })

  it('reports how many given-up rows the prune removed, ignoring processed ones', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    pruned = [{ attempts: 10 }, { attempts: 2 }, { attempts: 12 }]
    await drainOutbox('food', fakeProvider(), {})
    expect(info).toHaveBeenCalledWith({ entity: 'food', deleted: 2 }, expect.any(String))
  })

  it('says nothing about pruning when no given-up row was removed', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    pruned = [{ attempts: 0 }]
    await drainOutbox('food', fakeProvider(), {})
    expect(info).not.toHaveBeenCalled()
  })

  it('prunes old processed and abandoned rows of its own entity only', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    await drainOutbox('exercise', fakeProvider(), {})
    const query = rendered(deleteWhere!)
    expect(query.params).toEqual(['exercise', 10])
    expect(query.sql).toContain(`interval '7 days'`)
    expect(query.sql).toContain('"processed_at" is not null')
  })
})
