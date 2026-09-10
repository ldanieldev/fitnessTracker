import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIGRATION = new URL('../../drizzle/0012_backfill_import_descriptions.sql', import.meta.url)

describe('backfill_import_descriptions migration', () => {
  it('only backfills imported entries whose description is still null', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain('e.import_key IS NOT NULL')
    expect(sql).toContain('e.description IS NULL')
  })
})
