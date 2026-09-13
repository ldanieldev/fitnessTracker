import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { users } from '../../server/db/schema/users'

describe('users.weekStart', () => {
  it('defaults to 1 (Monday), matching pre-existing behaviour', () => {
    const column = getTableConfig(users).columns.find((c) => c.name === 'week_start')
    expect(column?.default).toBe(1)
    expect(column?.notNull).toBe(true)
  })

  it('has a check constraint restricting it to 0 or 1', () => {
    const check = getTableConfig(users).checks.find((c) => c.name === 'users_week_start_check')
    expect(check).toBeDefined()
  })
})
