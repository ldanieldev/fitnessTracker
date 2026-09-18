import { describe, expect, it } from 'vitest'
import { buildSeedSql } from '../../shared/utils/exerciseSeedSql'
import type { SeedEntry } from '../../shared/utils/exerciseSeedMap'

const bench: SeedEntry = {
  id: 'Barbell_Bench_Press',
  name: 'Barbell Bench Press',
  category: 'strength',
  equipment: 'barbell',
  level: 'beginner',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  instructions: ['Lie on the bench.', 'O\'Brien grip.'],
  images: ['Barbell_Bench_Press/0.jpg', 'Barbell_Bench_Press/1.jpg']
}

describe('buildSeedSql', () => {
  it('upserts the exercise on its external id and never on the name', () => {
    const sql = buildSeedSql([bench])
    expect(sql).toContain('on conflict (external_id) where created_by_user_id is null do update')
    expect(sql).not.toContain('on conflict (name)')
  })

  it('escapes quotes in text so the SQL stays valid', () => {
    expect(buildSeedSql([bench])).toContain('O\'\'Brien grip.')
  })

  it('links primary and secondary muscles with the right flag', () => {
    const sql = buildSeedSql([bench])
    expect(sql).toContain('(\'Barbell_Bench_Press\', \'chest\', true)')
    expect(sql).toContain('(\'Barbell_Bench_Press\', \'triceps\', false)')
  })

  it('emits every category and muscle seed regardless of the entries given', () => {
    const sql = buildSeedSql([])
    for (const key of ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'neck', 'cardio']) {
      expect(sql).toContain(`'${key}'`)
    }
    expect(sql).toContain('\'abdominals\'')
  })

  it('writes no equipment row for an entry with no equipment', () => {
    const sql = buildSeedSql([bench, { ...bench, id: 'No_Kit', name: 'No Kit', equipment: null }])
    expect(sql).toContain('(\'Barbell_Bench_Press\', \'barbell\')')
    expect(sql).not.toContain('(\'No_Kit\', \'barbell\')')
    expect(sql).not.toMatch(/\('No_Kit', '[^']*'\)/)
  })

  it('restamps updated_at on every reference upsert so the catalogue cache key rolls on a re-seed', () => {
    const sql = buildSeedSql([])
    const upserts = sql.split('--> statement-breakpoint').filter((s) => s.includes('do update set'))
    expect(upserts).toHaveLength(3)
    for (const upsert of upserts) expect(upsert).toContain('updated_at = now();')
  })

  it('refreshes the muscle name on a re-seed, not only its mapping columns', () => {
    const statements = buildSeedSql([]).split('--> statement-breakpoint')
    expect(statements.find((s) => s.includes('insert into app.muscles'))).toContain('name = excluded.name')
  })

  it('is deterministic for the same input', () => {
    expect(buildSeedSql([bench])).toBe(buildSeedSql([bench]))
  })
})
