import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const select = vi.fn()
const update = vi.fn()

vi.mock('../../server/utils/db', () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args)
  }
}))

const dialect = new PgDialect()

function rendered(where: SQL) {
  return dialect.sqlToQuery(where)
}

const OUTBOX = [
  { id: 1, entity: 'food', entityId: 11, op: 'upsert' as const },
  { id: 2, entity: 'exercise', entityId: 22, op: 'upsert' as const },
  { id: 3, entity: 'exercise', entityId: 23, op: 'delete' as const },
  { id: 4, entity: 'food', entityId: 12, op: 'delete' as const }
]

let selectWhere: SQL | undefined
let updateWhere: SQL | undefined

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
        return OUTBOX.filter((row) => row.entity === entity).map(({ id, entityId, op }) => ({ id, entityId, op }))
      }
    }
    return chain
  })
  update.mockImplementation(() => {
    const chain = {
      set: () => chain,
      where: async (where: SQL) => {
        updateWhere = where
      }
    }
    return chain
  })
}

function fakeProvider() {
  return { index: vi.fn(async () => {}), delete: vi.fn(async () => {}), rebuild: vi.fn(async () => {}) }
}

describe('drainOutbox entity scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectWhere = undefined
    updateWhere = undefined
    stubDb()
  })

  it('filters the batch to exercise rows and touches no food entity', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()

    const result = await drainOutbox('exercise', provider, {})

    expect(rendered(selectWhere!).sql).toContain('"entity" = $1')
    expect(rendered(selectWhere!).params).toEqual(['exercise'])
    expect(provider.index.mock.calls.flat()).toEqual([22])
    expect(provider.delete.mock.calls.flat()).toEqual([23])
    expect(rendered(updateWhere!).params).toEqual([2, 3])
    expect(result).toEqual({ processed: 2, failed: 0, skipped: false, rebuilt: false })
  })

  it('filters the batch to food rows and touches no exercise entity', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()

    const result = await drainOutbox('food', provider, {})

    expect(rendered(selectWhere!).params).toEqual(['food'])
    expect(provider.index.mock.calls.flat()).toEqual([11])
    expect(provider.delete.mock.calls.flat()).toEqual([12])
    expect(rendered(updateWhere!).params).toEqual([1, 4])
    expect(result.processed).toBe(2)
  })

  it('rebuilds only when the isEmpty hook reports an empty index', async () => {
    const { drainOutbox } = await import('../../server/utils/search/outboxDrain')
    const provider = fakeProvider()

    expect((await drainOutbox('exercise', provider, { isEmpty: async () => false })).rebuilt).toBe(false)
    expect(provider.rebuild).not.toHaveBeenCalled()

    expect((await drainOutbox('exercise', provider, { isEmpty: async () => true })).rebuilt).toBe(true)
    expect(provider.rebuild).toHaveBeenCalledTimes(1)
  })
})
