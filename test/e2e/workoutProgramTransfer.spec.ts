import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Program, ProgramImportResult } from '../../shared/types/program'
import type { Routine } from '../../shared/types/routine'
import type { Exercise, ExerciseCategory } from '../../shared/types/workout'
import type { ProgramExport } from '../../shared/utils/programExport'

async function setup(page: Page) {
  const cats = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json.categories
  const custom = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Xfer Fly '), categoryId: cats.find((c) => c.key === 'chest')!.id, trackingType: 'weight_reps', loadStyle: 'plain'
  })).json
  const catalogue = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=squat&limit=5')).json.find((e) => e.shared)!
  const r = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('Xfer R ') })).json
  const withDay = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${r.id}/days`, { name: 'Day 1' })).json
  const dayId = withDay.days[0]!.id
  await apiFetch(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId: catalogue.id })
  const after = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId: custom.id })).json
  await apiFetch(page, 'PATCH', `/api/workouts/routine-entries/${after.days[0]!.entries[1]!.id}`, { targetLow: 8, targetHigh: 12, optional: true })
  const p = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Xfer P ') })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/phases`, { name: 'Main', weeks: 6, routineId: r.id })
  await apiFetch(page, 'POST', `/api/workouts/programs/${p.id}/phases`, { name: 'Off', weeks: 1 })
  return { custom, catalogue, program: p }
}

test('export → import round-trip; re-import matches exercises', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const { custom, catalogue, program } = await setup(page)

  const exported = await apiFetch<ProgramExport>(page, 'GET', `/api/workouts/programs/${program.id}/export`)
  expect(exported.status).toBe(200)
  expect(exported.json).toMatchObject({ format: 'mfj-program', version: 1, program: { phases: [{ routine: 0 }, { routine: null }] } })
  const entries = exported.json.routines[0]!.days[0]!.entries
  expect(entries[0]!.exercise).toMatchObject({ externalId: expect.any(String) })
  expect(entries[1]!.exercise).toMatchObject({ name: custom.name, trackingType: 'weight_reps', category: { name: 'Chest' } })
  expect(entries[1]).toMatchObject({ targetLow: 8, targetHigh: 12, optional: true })

  const first = (await apiFetch<ProgramImportResult>(page, 'POST', '/api/workouts/programs/import', exported.json)).json
  expect(first.exercises).toEqual({ matched: 2, created: [] })
  const imported = (await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${first.programId}`)).json
  expect(imported.phases.map((p) => [p.name, p.weeks, p.routine === null])).toEqual([['Main', 6, false], ['Off', 1, true]])
  expect(imported.phases[0]!.routine!.id).not.toBe(program.phases[0]?.routine?.id)
  const r = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${imported.phases[0]!.routine!.id}`)).json
  expect(r.active).toBe(false)
  expect(r.days[0]!.entries.map((e) => e.exerciseId)).toEqual([catalogue.id, custom.id])

  await registerViaApi(page, makeUser())
  const other = (await apiFetch<ProgramImportResult>(page, 'POST', '/api/workouts/programs/import', exported.json)).json
  expect(other.exercises).toEqual({ matched: 1, created: [custom.name] })
  const again = (await apiFetch<ProgramImportResult>(page, 'POST', '/api/workouts/programs/import', exported.json)).json
  expect(again.exercises).toEqual({ matched: 2, created: [] })
})

test('bad import files are rejected', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  expect((await apiFetch(page, 'POST', '/api/workouts/programs/import', { format: 'mfj-program', version: 9 })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/programs/import', {
    format: 'mfj-program', version: 1,
    program: { name: 'x', description: null, phases: [] },
    routines: [{ name: 'r', notes: null, days: [{ name: 'd', description: null, floating: false, entries: [{
      exercise: { externalId: 'Does_Not_Exist_Anywhere' }, targetSets: null, targetLow: null, targetHigh: null,
      targetWeight: null, supersetGroup: null, optional: false, restSeconds: null, notes: null
    }] }] }]
  })).status).toBe(400)
})

const entry = (exercise: object) => ({
  exercise, targetSets: null, targetLow: null, targetHigh: null, targetWeight: null,
  supersetGroup: null, optional: false, restSeconds: null, notes: null
})
const importFile = (entries: object[]) => ({
  format: 'mfj-program',
  version: 1,
  program: { name: uniquePrefix('Imp P '), description: null, phases: [{ name: 'Main', weeks: 1, deload: false, routine: 0 }] },
  routines: [{ name: uniquePrefix('Imp R '), notes: null, days: [{ name: 'Day', description: null, floating: false, entries }] }]
})
const customExercise = (name: string, category: { name: string, color: string }) =>
  ({ name, trackingType: 'weight_reps', loadStyle: 'plain', barWeight: null, category })

test('an import with an unknown catalogue exercise creates nothing', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Preflight Curl ')
  const curl = entry(customExercise(name, { name: 'Arms', color: 'sky' }))
  const bad = await apiFetch(page, 'POST', '/api/workouts/programs/import', importFile([curl, entry({ externalId: 'Does_Not_Exist_Anywhere' })]))
  expect(bad.status).toBe(400)
  const ok = await apiFetch<ProgramImportResult>(page, 'POST', '/api/workouts/programs/import', importFile([curl]))
  expect(ok.json.exercises).toEqual({ matched: 0, created: [name] })
})

test('import matches categories by name, hidden ones included, and creates missing ones', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const shared = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json.categories
  const chest = shared.find((c) => c.key === 'chest')!
  const hidden = shared.find((c) => c.shared && c.key !== 'chest')!
  expect((await apiFetch(page, 'PATCH', `/api/workouts/categories/${hidden.id}`, { hidden: true })).status).toBe(200)
  const fresh = uniquePrefix('Neck ')
  const names = [uniquePrefix('Cat Fly '), uniquePrefix('Cat Hidden '), uniquePrefix('Cat Neck ')]
  const result = (await apiFetch<ProgramImportResult>(page, 'POST', '/api/workouts/programs/import', importFile([
    entry(customExercise(names[0]!, { name: 'CHEST', color: 'teal' })),
    entry(customExercise(names[1]!, { name: hidden.name.toUpperCase(), color: 'rose' })),
    entry(customExercise(names[2]!, { name: fresh, color: 'violet' }))
  ]))).json
  expect(result.exercises).toEqual({ matched: 0, created: names })
  const imported = (await apiFetch<Program>(page, 'GET', `/api/workouts/programs/${result.programId}`)).json
  const r = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${imported.phases[0]!.routine!.id}`)).json
  const categories = await Promise.all(r.days[0]!.entries.map(async (e) =>
    (await apiFetch<Exercise>(page, 'GET', `/api/workouts/exercises/${e.exerciseId}`)).json.category))
  expect(categories[0]!.id).toBe(chest.id)
  expect(categories[1]!.id).toBe(hidden.id)
  expect(categories[2]).toMatchObject({ name: fresh, color: 'violet', shared: false })
  const all = (await apiFetch<ExerciseCategory[]>(page, 'GET', '/api/workouts/categories?includeHidden=true')).json
  expect(all.filter((c) => c.name.toLowerCase() === 'chest')).toHaveLength(1)
  expect(all.filter((c) => c.name.toLowerCase() === hidden.name.toLowerCase())).toHaveLength(1)
})

test('an import that fails part-way leaves no category, exercise, routine or program behind', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json.categories
    .find((c) => c.key === 'chest')!
  const taken = uniquePrefix('Taken Row ')
  for (const [name, trackingType] of [[taken, 'weight_reps'], [`${taken} (imported)`, 'weight_distance']]) {
    const res = await apiFetch(page, 'POST', '/api/workouts/exercises', { name, categoryId: chest.id, trackingType, loadStyle: 'plain' })
    expect(res.status).toBe(200)
  }
  const fresh = uniquePrefix('Rollback Cat ')
  const first = uniquePrefix('Rollback Fly ')
  const res = await apiFetch(page, 'POST', '/api/workouts/programs/import', importFile([
    entry(customExercise(first, { name: fresh, color: 'violet' })),
    entry({ name: taken, trackingType: 'distance_time', loadStyle: null, barWeight: null, category: { name: fresh, color: 'violet' } })
  ]))
  expect([res.status, (res.json as { statusMessage?: string }).statusMessage]).toEqual([409, 'You already have an exercise with that name'])
  const categories = (await apiFetch<ExerciseCategory[]>(page, 'GET', '/api/workouts/categories?includeHidden=true')).json
  expect(categories.filter((c) => c.name === fresh)).toEqual([])
  const own = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises')).json.filter((e) => !e.shared)
  expect(own.map((e) => e.name).sort()).toEqual([taken, `${taken} (imported)`].sort())
  expect((await apiFetch<unknown[]>(page, 'GET', '/api/workouts/routines')).json).toEqual([])
  expect((await apiFetch<unknown[]>(page, 'GET', '/api/workouts/programs')).json).toEqual([])
})
