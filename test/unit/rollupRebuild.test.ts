import { beforeEach, describe, expect, it, vi } from 'vitest'

const PG_PARAM_LIMIT = 65_535
const SESSIONS = 450
const EXERCISES_PER_SESSION = 80

interface Recorded {
  text: string
  params: unknown[]
}

const queries: Recorded[] = []

function respond(text: string, params: unknown[]): unknown[][] {
  if (text.includes('"one_rep_max_rep_cap"')) return [[10]]
  if (/^select "id" from "app"."workout_sessions" where "app"."workout_sessions"."user_id" = \$1 order/.test(text)) {
    return Array.from({ length: SESSIONS }, (_, i) => [i + 1])
  }
  if (text.startsWith('select "app"."workout_entries"."session_id"') && text.includes('from "app"."workout_sets"')) {
    const sessionIds = params as number[]
    return sessionIds.flatMap((sessionId) =>
      Array.from({ length: EXERCISES_PER_SESSION }, (_, e) => [
        sessionId,
        e + 1,
        '2026-10-01',
        'weight_reps',
        'plain',
        '100',
        5,
        null,
        null
      ])
    )
  }
  return []
}

const fakeClient = {
  query(config: { text: string } | string, params: unknown[] = []) {
    const text = typeof config === 'string' ? config : config.text
    queries.push({ text, params })
    return Promise.resolve({ rows: respond(text, params), rowCount: 0 })
  }
}

vi.mock('../../server/utils/db', async () => {
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const schema = await import('../../server/db/schema')
  return { db: drizzle({ client: fakeClient as never, schema }) }
})

describe('rebuildUserRollups', () => {
  beforeEach(() => {
    queries.length = 0
  })

  it('rebuilds a history whose pairs would overflow one NOT IN list, with bounded bind parameters', async () => {
    const { rebuildUserRollups, REBUILD_CHUNK } = await import('../../server/utils/workouts/rollups')
    const pairs = SESSIONS * EXERCISES_PER_SESSION
    expect(pairs * 2).toBeGreaterThan(PG_PARAM_LIMIT)

    const result = await rebuildUserRollups(1)
    expect(result).toEqual({ rows: pairs })

    for (const query of queries) expect(query.params.length).toBeLessThan(PG_PARAM_LIMIT)
    const prunes = queries.filter((q) => q.text.startsWith('delete from "app"."workout_exercise_rollups"'))
    expect(prunes).toHaveLength(Math.ceil(SESSIONS / REBUILD_CHUNK))
    for (const prune of prunes) {
      expect(prune.text).toContain('not exists')
      expect(prune.text).not.toContain('not in')
      expect(prune.params.length).toBeLessThanOrEqual(REBUILD_CHUNK)
    }
    expect(queries.filter((q) => q.text.includes('"one_rep_max_rep_cap"'))).toHaveLength(1)
  })

  it('locks each chunk of sessions before reading its sets, and prunes after upserting', async () => {
    const { rebuildUserRollups } = await import('../../server/utils/workouts/rollups')
    await rebuildUserRollups(1)
    const begin = queries.findIndex((q) => q.text === 'begin')
    const chunk = queries.slice(begin, queries.findIndex((q, i) => i > begin && q.text === 'commit') + 1)
    const kinds = chunk.map((q) =>
      q.text === 'begin' || q.text === 'commit'
        ? q.text
        : q.text.endsWith('for no key update')
          ? 'lock'
          : q.text.startsWith('insert')
            ? 'upsert'
            : q.text.startsWith('delete')
              ? 'prune'
              : 'read'
    )
    expect(kinds[0]).toBe('begin')
    expect(kinds[1]).toBe('lock')
    expect(kinds[2]).toBe('read')
    expect(kinds.filter((k) => k === 'upsert').length).toBeGreaterThan(1)
    expect(kinds.at(-2)).toBe('prune')
    expect(kinds.at(-1)).toBe('commit')
  })
})
