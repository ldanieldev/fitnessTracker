import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()
// Drizzle renders appSchema columns schema-qualified (probed with PgDialect.sqlToQuery on 2026-10-07).
const COALESCE = 'coalesce("app"."exercise_prefs"."category_id", "app"."exercises"."category_id")'

describe('sessionFilterWhere categories', () => {
  it('matches categories through the one effective-category expression', async () => {
    const { effectiveCategoryId, sessionFilterWhere } = await import('../../server/utils/workouts/sessionFilter')
    expect(dialect.sqlToQuery(effectiveCategoryId).sql).toBe(COALESCE)
    const { sql, params } = dialect.sqlToQuery(sessionFilterWhere(1, { match: 'all', categories: [3, 5] }))
    expect(sql.split(COALESCE)).toHaveLength(3)
    expect(params).toEqual(expect.arrayContaining([3, 5, 2]))
  })
})
