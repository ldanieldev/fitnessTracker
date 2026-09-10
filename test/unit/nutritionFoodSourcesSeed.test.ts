import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIGRATION = new URL('../../drizzle/0008_seed_food_sources.sql', import.meta.url)

interface FoodSourceSeedRow {
  key: string
  name: string
  licenseNotice: string | null
  attributionRequired: boolean
  persistable: boolean
}

const ROW_RE = /\('([^']*)','([^']*)',(NULL|'[^']*'),(true|false),(true|false)\)/g

function migrationRows(): FoodSourceSeedRow[] {
  const sql = readFileSync(MIGRATION, 'utf8')
  const values = sql.slice(sql.indexOf('VALUES') + 'VALUES'.length, sql.indexOf('ON CONFLICT'))
  return [...values.matchAll(ROW_RE)].map((m) => ({
    key: m[1]!,
    name: m[2]!,
    licenseNotice: m[3] === 'NULL' ? null : m[3]!.slice(1, -1),
    attributionRequired: m[4] === 'true',
    persistable: m[5] === 'true'
  }))
}

describe('seed_food_sources migration', () => {
  it('seeds exactly off, usda, fatsecret and user', () => {
    expect(migrationRows().map((r) => r.key)).toEqual(['off', 'usda', 'fatsecret', 'user'])
  })

  it('marks off and usda persistable, fatsecret fetch-only', () => {
    const byKey = Object.fromEntries(migrationRows().map((r) => [r.key, r]))
    expect(byKey.off!.persistable).toBe(true)
    expect(byKey.usda!.persistable).toBe(true)
    expect(byKey.fatsecret!.persistable).toBe(false)
    expect(byKey.user!.persistable).toBe(true)
  })

  it('requires attribution for off and fatsecret but not usda or user', () => {
    const byKey = Object.fromEntries(migrationRows().map((r) => [r.key, r]))
    expect(byKey.off!.attributionRequired).toBe(true)
    expect(byKey.fatsecret!.attributionRequired).toBe(true)
    expect(byKey.usda!.attributionRequired).toBe(false)
    expect(byKey.user!.attributionRequired).toBe(false)
  })

  it('leaves the user source with no license notice', () => {
    const byKey = Object.fromEntries(migrationRows().map((r) => [r.key, r]))
    expect(byKey.user!.licenseNotice).toBeNull()
  })

  it('upserts on the key so re-running it is a no-op', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain('ON CONFLICT (key) DO UPDATE SET')
  })
})
