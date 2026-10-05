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
