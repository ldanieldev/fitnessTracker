import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { NutrientSeed } from '../../server/db/seed/nutrition'

const MIGRATION = new URL('../../drizzle/0001_nutrition.sql', import.meta.url)

const ROW_RE = /\('([^']*)', '([^']*)', '([^']*)', (true|false), '([^']*)', (\d+)\)/g

function migrationRows(): NutrientSeed[] {
  const sql = readFileSync(MIGRATION, 'utf8')
  return [...sql.matchAll(ROW_RE)].map((m) => ({
    key: m[1]!,
    name: m[2]!,
    unit: m[3]! as NutrientSeed['unit'],
    isMacro: m[4] === 'true',
    defaultDirection: m[5]! as NutrientSeed['defaultDirection'],
    sortOrder: Number(m[6])
  }))
}

describe('nutrient seed catalogue', () => {
  it('has unique keys', async () => {
    const { NUTRIENT_SEED } = await import('../../server/db/seed/nutrition')
    const keys = NUTRIENT_SEED.map((n) => n.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('marks energy, protein, carbohydrate and fat as macros', async () => {
    const { NUTRIENT_SEED } = await import('../../server/db/seed/nutrition')
    const macros = NUTRIENT_SEED.filter((n) => n.isMacro).map((n) => n.key).sort()
    expect(macros).toEqual(['carbohydrate', 'energy', 'fat', 'protein'])
  })

  it('gives protein and fiber a min direction and energy a max direction', async () => {
    const { NUTRIENT_SEED } = await import('../../server/db/seed/nutrition')
    const by = Object.fromEntries(NUTRIENT_SEED.map((n) => [n.key, n.defaultDirection]))
    expect(by.protein).toBe('min')
    expect(by.fiber).toBe('min')
    expect(by.energy).toBe('max')
    expect(by.fat).toBe('max')
  })

  it('assigns a contiguous sort order starting at 0', async () => {
    const { NUTRIENT_SEED } = await import('../../server/db/seed/nutrition')
    const orders = NUTRIENT_SEED.map((n) => n.sortOrder).sort((a, b) => a - b)
    expect(orders).toEqual(orders.map((_, i) => i))
  })
})

describe('seed_nutrients migration', () => {
  it('inserts exactly the NUTRIENT_SEED rows', async () => {
    const { NUTRIENT_SEED } = await import('../../server/db/seed/nutrition')
    expect(migrationRows()).toEqual(NUTRIENT_SEED)
  })

  it('upserts on the key so re-running it is a no-op', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    expect(sql).toContain('ON CONFLICT ("key") DO UPDATE SET')
  })
})
