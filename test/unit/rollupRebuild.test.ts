import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTableName, type Table } from 'drizzle-orm'

const ops: string[] = []
const state = { inserts: 0, failOnInsert: 0 }

const rows: Record<string, unknown[]> = {
  workout_entries: [10, 11, 12].map((sessionId) => ({ userId: 1, sessionId, exerciseId: 5 })),
  workout_sessions: [{ performedOn: '2026-10-01' }],
  workout_sets: [
    {
      trackingType: 'weight_reps',
      loadStyle: 'plain',
      weight: '100',
      reps: 5,
      distanceMeters: null,
      durationSeconds: null
    }
  ],
  users: [{ cap: 10 }],
  workout_exercise_goals: [
    { userId: 1, exerciseId: 5, metric: 'max_weight', targetValue: '300', targetReps: null, achievedAt: null }
  ],
  workout_exercise_rollups: []
}

interface FakeQuery extends PromiseLike<unknown[]> {
  from: (table: Table) => FakeQuery
  innerJoin: () => FakeQuery
  where: () => FakeQuery
  orderBy: () => FakeQuery
  values: () => FakeQuery
  set: () => FakeQuery
  onConflictDoUpdate: () => FakeQuery
}

// Stands in for Drizzle's builders: awaiting a chain records `op:table` and serves canned rows for that table.
function query(op: string, table?: Table): FakeQuery {
  let name = table ? getTableName(table) : ''
  const chain: FakeQuery = {
    from: (t: Table) => {
      name = getTableName(t)
      return chain
    },
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    values: () => chain,
    set: () => chain,
    onConflictDoUpdate: () => chain,
    then<A = unknown[], B = never>(
      onfulfilled?: ((value: unknown[]) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
    ): PromiseLike<A | B> {
      ops.push(`${op}:${name}`)
      const crash = op === 'insert' && ++state.inserts === state.failOnInsert
      const result: Promise<unknown[]> = crash
        ? Promise.reject(new Error('crash'))
        : Promise.resolve(op.startsWith('select') ? (rows[name] ?? []) : [])
      return result.then(onfulfilled, onrejected)
    }
  }
  return chain
}

vi.mock('../../server/utils/db', () => ({
  db: {
    select: () => query('select'),
    selectDistinct: () => query('selectDistinct'),
    insert: (table: Table) => query('insert', table),
    update: (table: Table) => query('update', table),
    delete: (table: Table) => query('delete', table)
  }
}))

describe('rebuildRollups', () => {
  beforeEach(() => {
    ops.length = 0
    state.inserts = 0
    state.failOnInsert = 0
  })

  it('writes every pair before pruning, then stamps each goal once', async () => {
    const { rebuildRollups } = await import('../../server/utils/workouts/rollups')
    expect(await rebuildRollups(1)).toEqual({ rows: 3 })

    const inserts = ops.flatMap((op, i) => (op === 'insert:workout_exercise_rollups' ? [i] : []))
    const prune = ops.indexOf('delete:workout_exercise_rollups')
    expect(inserts).toHaveLength(3)
    expect(prune).toBeGreaterThan(inserts.at(-1)!)
    const goalReads = ops.flatMap((op, i) => (op === 'select:workout_exercise_goals' ? [i] : []))
    expect(goalReads).toHaveLength(1)
    expect(goalReads[0]).toBeGreaterThan(prune)
  })

  it('a crash mid-loop leaves the existing rows alone', async () => {
    const { rebuildRollups } = await import('../../server/utils/workouts/rollups')
    state.failOnInsert = 2
    await expect(rebuildRollups(1)).rejects.toThrow('crash')
    expect(ops.filter((op) => op.startsWith('delete:'))).toEqual([])
  })
})
