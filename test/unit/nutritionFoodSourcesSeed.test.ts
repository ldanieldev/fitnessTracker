import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIGRATION = new URL('../../drizzle/0001_nutrition.sql', import.meta.url)

interface FoodSourceSeedRow {
  key: string
  name: string
  licenseNotice: string | null
  attributionRequired: boolean
  persistable: boolean
}

const ROW_RE = /\('([^']*)','([^']*)',(NULL|'[^']*'),(true|false),(true|false)\)/g

function rowsFrom(migration: URL): FoodSourceSeedRow[] {
  const sql = readFileSync(migration, 'utf8')
  const insert = sql.slice(sql.indexOf('INSERT INTO "app"."food_sources"'))
  const values = insert.slice(insert.indexOf('VALUES') + 'VALUES'.length, insert.indexOf(';'))
  return [...values.matchAll(ROW_RE)].map((m) => ({
    key: m[1]!,
    name: m[2]!,
    licenseNotice: m[3] === 'NULL' ? null : m[3]!.slice(1, -1),
    attributionRequired: m[4] === 'true',
    persistable: m[5] === 'true'
  }))
}

function migrationRows(): FoodSourceSeedRow[] {
  return rowsFrom(MIGRATION)
}

describe('seed_food_sources migration', () => {
  it('seeds exactly off, usda, fatsecret, user and mymacros', () => {
    expect(migrationRows().map((r) => r.key)).toEqual(['off', 'usda', 'fatsecret', 'user', 'mymacros'])
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

describe('mymacros food source', () => {
  it('is seeded as persistable with no attribution required', () => {
    const row = rowsFrom(MIGRATION).find((r) => r.key === 'mymacros')
    expect(row).toMatchObject({ persistable: true, attributionRequired: false })
  })
})
