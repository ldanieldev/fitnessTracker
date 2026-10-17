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

const fakeDb = {
  insert: () => {
    inserts.push('insert')
    return chain()
  },
  transaction: async (run: (tx: typeof fakeDb) => Promise<unknown>) => run(fakeDb)
}

vi.mock('../../server/utils/db', () => ({ db: fakeDb }))
vi.mock('../../server/utils/workouts/fitnotes/preview', () => ({
  exerciseOptions: async () => [],
  fitNotesImportKey: (date: string) => `fitnotes:${date}`,
  sessionDays: async () => ({ imported: new Set(['2026-09-28']), existing: new Set() })
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
  it('beats once per imported day inside that day\'s transaction, never for a skipped day', async () => {
    const { performFitNotesImport } = await import('../../server/utils/workouts/fitnotes/run')
    const beats: unknown[] = []
    const result = await performFitNotesImport(
      7,
      { csv: CSV, mapping: { 'Barbell Row': 3 }, skipExistingDays: false },
      async (tx) => {
        beats.push(tx)
      }
    )
    expect(result).toMatchObject({ daysImported: 2, daysSkippedImported: 1 })
    expect(beats).toEqual([fakeDb, fakeDb])
  })
})
