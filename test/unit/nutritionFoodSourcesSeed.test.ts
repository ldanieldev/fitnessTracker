import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIGRATION = new URL('../../drizzle/0001_nutrition.sql', import.meta.url)

const ROW_RE = /\('([^']*)','([^']*)',(NULL|'[^']*'),(true|false),(true|false)\)/g

function migrationRows() {
  const sql = readFileSync(MIGRATION, 'utf8')
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

describe('seed_food_sources migration', () => {
  it('seeds exactly the five sources with their licence, attribution and persistence flags', () => {
    expect(migrationRows()).toEqual([
      { key: 'off', name: 'Open Food Facts', licenseNotice: 'ODbL — https://opendatacommons.org/licenses/odbl/', attributionRequired: true, persistable: true },
      { key: 'usda', name: 'USDA FoodData Central', licenseNotice: 'Public domain (CC0)', attributionRequired: false, persistable: true },
      { key: 'fatsecret', name: 'FatSecret', licenseNotice: 'Commercial — fetch-only', attributionRequired: true, persistable: false },
      { key: 'user', name: 'User created', licenseNotice: null, attributionRequired: false, persistable: true },
      { key: 'mymacros', name: 'My Macros+ import', licenseNotice: null, attributionRequired: false, persistable: true }
    ])
  })

  it('upserts on the key so re-running it is a no-op', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain('ON CONFLICT (key) DO UPDATE SET')
  })
})
