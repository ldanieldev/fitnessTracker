import { describe, expect, it } from 'vitest'
import { getTableConfig } from 'drizzle-orm/pg-core'

const indexed = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((index) => [index.config.name, index.config.columns.map((column) => (column as { name: string }).name)])

describe('program schema indexes', () => {
  it('indexes programs by owner and enrollments by program', async () => {
    const { programs, userProgramEnrollments } = await import('../../server/db/schema')
    expect(indexed(programs)).toContainEqual(['program_user', ['user_id']])
    expect(indexed(userProgramEnrollments)).toContainEqual(['enrollment_program', ['program_id']])
  })
})
