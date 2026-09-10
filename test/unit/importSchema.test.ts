import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { diaryEntries } from '../../server/db/schema/nutrition/diary'
import { importJobs } from '../../server/db/schema/nutrition/import'

describe('importJobs schema', () => {
  it('is named import_jobs', () => {
    expect(getTableConfig(importJobs).name).toBe('import_jobs')
  })

  it('defaults status to queued', () => {
    const status = getTableConfig(importJobs).columns.find((c) => c.name === 'status')
    expect(status?.default).toBe('queued')
  })
})

describe('diaryEntries.importKey', () => {
  it('has a partial unique index on import_key', () => {
    const index = getTableConfig(diaryEntries).indexes.find((i) => i.config.name === 'diary_entry_import_key_unique')
    expect(index).toBeDefined()
    expect(index!.config.unique).toBe(true)
    expect(index!.config.where).toBeDefined()
  })
})
