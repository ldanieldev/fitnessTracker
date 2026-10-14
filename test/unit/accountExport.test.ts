import { describe, expect, it } from 'vitest'
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

describe('account export coverage', () => {
  it('exports, references or deliberately excludes every table in the schema', async () => {
    const schema = await import('../../server/db/schema')
    const { accountTables, EXPORT_EXCLUDED_TABLES, EXPORT_REFERENCE_TABLES } = await import(
      '../../server/utils/export/account'
    )
    const inSchema = Object.values(schema)
      .filter((value) => is(value, PgTable))
      .map((table) => getTableName(table as PgTable))
      .sort()
    const covered = [
      ...Object.keys(accountTables(1)),
      ...Object.keys(EXPORT_EXCLUDED_TABLES),
      ...EXPORT_REFERENCE_TABLES
    ].sort()
    expect(covered).toEqual(inSchema)
  })
})
