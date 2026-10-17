import { describe, expect, it, vi } from 'vitest'

const inserts: string[] = []

function chain(result: unknown[] = [{ id: 1 }]) {
  const c = {
    values: () => c,
    returning: () => c,
    then: <A>(onfulfilled?: (value: unknown[]) => A) => Promise.resolve(result).then(onfulfilled)
  }
  return c
}

const insert = () => {
  inserts.push('insert')
  return chain()
}
const fakeTx = { insert }
const fakeDb = {
  insert,
  transaction: async (run: (tx: typeof fakeTx) => Promise<unknown>) => run(fakeTx)
}
const importedDays = vi.hoisted(() => ({ dates: new Set<string>() }))

vi.mock('../../server/utils/db', () => ({ db: fakeDb }))
vi.mock('../../server/utils/workouts/fitnotes/preview', () => ({
  exerciseOptions: async () => [],
  fitNotesImportKey: (date: string) => `fitnotes:${date}`,
  sessionDays: async () => ({ imported: importedDays.dates, existing: new Set() })
}))
vi.mock('../../server/utils/workouts/categories', () => ({ listCategoriesForUser: async () => [] }))
vi.mock('../../server/utils/workouts/exercises', () => ({
  loadExerciseSettings: async () => ({ trackingType: 'weight_reps', loadStyle: null })
}))
vi.mock('../../server/utils/workouts/exerciseWrites', () => ({ insertExercise: vi.fn() }))
vi.mock('../../server/utils/workouts/rollups', () => ({ rebuildRollups: vi.fn() }))

const CSV = [
  'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment',
  '2026-09-28,Barbell Row,Back,185.0,lbs,5,,,,""',
  '2026-09-29,Barbell Row,Back,185.0,lbs,5,,,,""',
  '2026-10-06,Barbell Row,Back,190.0,lbs,5,,,,""'
].join('\n')

describe('performFitNotesImport', () => {
  it('beats per imported day inside its transaction and once before the rollup rebuild', async () => {
    importedDays.dates = new Set(['2026-09-28'])
    const { performFitNotesImport } = await import('../../server/utils/workouts/fitnotes/run')
    const { rebuildRollups } = await import('../../server/utils/workouts/rollups')
    const beats: unknown[] = []
    const result = await performFitNotesImport(
      7,
      { csv: CSV, mapping: { 'Barbell Row': 3 }, skipExistingDays: false },
      async (client) => {
        beats.push(client)
        expect(rebuildRollups).not.toHaveBeenCalled()
      }
    )
    expect(result).toMatchObject({ daysImported: 2, daysSkippedImported: 1 })
    expect(beats).toEqual([fakeTx, fakeTx, fakeDb])
    expect(rebuildRollups).toHaveBeenCalledTimes(1)
  })

  it('beats outside any transaction every hundred skipped days', async () => {
    const dates = Array.from({ length: 250 }, (_, i) => new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10))
    importedDays.dates = new Set(dates)
    const csv = [CSV.split('\n')[0], ...dates.map((date) => `${date},Barbell Row,Back,185.0,lbs,5,,,,""`)].join('\n')
    const { performFitNotesImport } = await import('../../server/utils/workouts/fitnotes/run')
    const beats: unknown[] = []
    const payload = { csv, mapping: { 'Barbell Row': 3 }, skipExistingDays: false }
    const result = await performFitNotesImport(7, payload, async (client) => {
      beats.push(client)
    })
    expect(result).toMatchObject({ daysImported: 0, daysSkippedImported: 250 })
    expect(beats).toEqual([fakeDb, fakeDb])
  })
})
