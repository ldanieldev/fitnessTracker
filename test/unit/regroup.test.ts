import { describe, expect, it, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { DbClient } from '../../server/utils/db'
import { regroup, ROUTINE_ENTRY_GROUPS } from '../../server/utils/workouts/groups'

type Row = { id: number; sort_order: number; superset_group: number | null }

function fakeTx(rows: Row[]) {
  const execute = vi.fn(async (_query: SQL) => ({ rows }))
  return { tx: { execute } as unknown as DbClient, execute }
}

const rows = (...groups: (number | null)[]): Row[] =>
  groups.map((group, index) => ({ id: index + 1, sort_order: index, superset_group: group }))

describe('regroup', () => {
  it('writes nothing when the change keeps every row as it is', async () => {
    const { tx, execute } = fakeTx(rows(null, null, null))
    await regroup(tx, ROUTINE_ENTRY_GROUPS, 7, (items) => items)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('writes only the rows whose position changed', async () => {
    const { tx, execute } = fakeTx(rows(null, null, null))
    await regroup(tx, ROUTINE_ENTRY_GROUPS, 7, (items) => [items[1]!, items[0]!, items[2]!])
    expect(execute).toHaveBeenCalledTimes(3)
  })

  it('writes a row whose group changed in place', async () => {
    const { tx, execute } = fakeTx(rows(1, 1, null))
    await regroup(tx, ROUTINE_ENTRY_GROUPS, 7, (items) => items.map((item) => ({ ...item, supersetGroup: null })))
    expect(execute).toHaveBeenCalledTimes(3)
  })

  it('closes a gap in the stored order', async () => {
    const { tx, execute } = fakeTx([
      { id: 1, sort_order: 0, superset_group: null },
      { id: 2, sort_order: 5, superset_group: null }
    ])
    await regroup(tx, ROUTINE_ENTRY_GROUPS, 7, (items) => items)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('locks the rows in id order before reading them, so a queued regroup decides from the latest positions', async () => {
    const { tx, execute } = fakeTx(rows(null, null))
    await regroup(tx, ROUTINE_ENTRY_GROUPS, 7, (items) => items)
    const { sql } = new PgDialect().sqlToQuery(execute.mock.calls[0]![0])
    expect(sql).toMatch(/order by "app"\."workout_template_entries"\."id"\s+for no key update\s*$/i)
  })

  it('reads positions by sort order even though the rows arrive in id order', async () => {
    const { tx, execute } = fakeTx([
      { id: 1, sort_order: 1, superset_group: null },
      { id: 2, sort_order: 0, superset_group: null }
    ])
    const seen: number[] = []
    await regroup(tx, ROUTINE_ENTRY_GROUPS, 7, (items) => {
      seen.push(...items.map((item) => item.id))
      return items
    })
    expect(seen).toEqual([2, 1])
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
