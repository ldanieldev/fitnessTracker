import { describe, expect, it, vi } from 'vitest'
import { and, eq, isNull, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { exerciseCategoryPrefs } from '../../server/db/schema'
import type { DbClient } from '../../server/utils/db'
import { writeSparsePref } from '../../server/utils/workouts/sparsePrefs'

function fakeTx() {
  const calls: { values?: unknown; set?: unknown; deleteWhere?: SQL } = {}
  const tx = {
    insert: vi.fn(() => ({
      values: (values: unknown) => {
        calls.values = values
        return {
          onConflictDoUpdate: async ({ set }: { set: unknown }) => {
            calls.set = set
          }
        }
      }
    })),
    delete: vi.fn(() => ({
      where: async (where: SQL) => {
        calls.deleteWhere = where
      }
    }))
  }
  return { tx: tx as unknown as DbClient, calls, spies: tx }
}

const row = {
  table: exerciseCategoryPrefs,
  key: { userId: 1, categoryId: 2 },
  target: [exerciseCategoryPrefs.userId, exerciseCategoryPrefs.categoryId],
  where: and(eq(exerciseCategoryPrefs.userId, 1), eq(exerciseCategoryPrefs.categoryId, 2)),
  empty: and(isNull(exerciseCategoryPrefs.name), isNull(exerciseCategoryPrefs.color))
}

describe('writeSparsePref', () => {
  it('does nothing for an empty patch', async () => {
    const { tx, spies } = fakeTx()
    await writeSparsePref(tx, row, {})
    expect(spies.insert).not.toHaveBeenCalled()
    expect(spies.delete).not.toHaveBeenCalled()
  })

  it('upserts the patch on the key, then deletes the row only where it is this row and empty', async () => {
    const { tx, calls } = fakeTx()
    await writeSparsePref(tx, row, { name: null })
    expect(calls.values).toEqual({ userId: 1, categoryId: 2, name: null })
    expect(calls.set).toEqual({ name: null })
    const query = new PgDialect().sqlToQuery(calls.deleteWhere!)
    const t = '"app"."exercise_category_prefs"'
    expect(query.sql).toBe(
      `((${t}."user_id" = $1 and ${t}."category_id" = $2) and (${t}."name" is null and ${t}."color" is null))`
    )
    expect(query.params).toEqual([1, 2])
  })
})
