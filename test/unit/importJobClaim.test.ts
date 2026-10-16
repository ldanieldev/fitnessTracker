import { beforeEach, describe, expect, it, vi } from 'vitest'

const ops: string[] = []
const sets: unknown[] = []
const results: unknown[][] = []

// Each awaited Drizzle chain records its op and resolves to the next canned result.
function query(op: string) {
  const chain = {
    from: () => chain,
    where: () => chain,
    returning: () => chain,
    set: (values: unknown) => {
      sets.push(values)
      return chain
    },
    then<A, B = never>(onfulfilled?: (value: unknown[]) => A, onrejected?: (reason: unknown) => B) {
      ops.push(op)
      return Promise.resolve(results.shift() ?? []).then(onfulfilled, onrejected)
    }
  }
  return chain
}

const fakeDb = {
  select: () => query('select'),
  update: () => query('update'),
  execute: async () => {
    ops.push('execute')
  },
  transaction: async (run: (tx: typeof fakeDb) => Promise<unknown>) => run(fakeDb)
}

vi.mock('../../server/utils/db', () => ({ db: fakeDb }))
vi.mock('../../server/utils/inngest/client', () => ({ inngest: { send: vi.fn() } }))

beforeEach(() => {
  ops.length = 0
  sets.length = 0
  results.length = 0
})

describe('runMyMacrosImport', () => {
  it('refuses a job that is not queued for that user without touching anything else', async () => {
    const { runMyMacrosImport } = await import('../../server/utils/nutrition/mymacros/run')
    results.push([])
    await expect(runMyMacrosImport(fakeDb as never, 42, 7)).rejects.toThrow(
      'Import job 42 is not a queued My Macros+ import for user 7'
    )
    expect(ops).toEqual(['update'])
    expect(sets).toEqual([{ status: 'running' }])
  })
})

describe('runFitNotesImport', () => {
  it('refuses a job that belongs to someone else', async () => {
    const { runFitNotesImport } = await import('../../server/utils/workouts/fitnotes/run')
    results.push([])
    await expect(runFitNotesImport(42, 7)).rejects.toThrow('FitNotes import job 42 not found for user 7')
    expect(ops).toEqual(['select'])
  })

  it.each(['running', 'done', 'failed'])('refuses a %s job and leaves its status alone', async (status) => {
    const { runFitNotesImport } = await import('../../server/utils/workouts/fitnotes/run')
    results.push([{ id: 42, userId: 7, status, payload: {} }], [{ status }])
    await expect(runFitNotesImport(42, 7)).rejects.toThrow('FitNotes import job 42 is not queued')
    expect(ops).toEqual(['select', 'execute', 'select'])
    expect(sets).toEqual([])
  })

  it('marks a queued job failed when another import of the same user is running', async () => {
    const { runFitNotesImport } = await import('../../server/utils/workouts/fitnotes/run')
    results.push([{ id: 42, userId: 7, status: 'queued', payload: {} }], [{ status: 'queued' }], [], [])
    await expect(runFitNotesImport(42, 7)).rejects.toThrow('Another FitNotes import is still running')
    expect(ops).toEqual(['select', 'execute', 'select', 'update', 'update'])
    expect(sets).toEqual([
      { status: 'running' },
      { status: 'failed', error: 'Another FitNotes import is still running; try again when it finishes' }
    ])
  })
})
