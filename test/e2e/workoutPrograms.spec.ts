import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Program, ProgramSummary } from '../../shared/types/program'
import type { Routine } from '../../shared/types/routine'

async function routineWithDay(page: Page, name = uniquePrefix('Prog Routine ')) {
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name })).json
  return (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name: 'Day A' })).json
}

test('program CRUD, phases, reorder, totals, duplicate', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const upper = await routineWithDay(page)
  const name = uniquePrefix('BLS ')
  const created = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name })).json
  expect(created).toMatchObject({ name, description: null, totalWeeks: 0, phases: [] })

  await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Phase 1', weeks: 8, routineId: upper.id })
  await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Deload', weeks: 1, routineId: upper.id, deload: true })
  let program = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/phases`, { name: 'Off', weeks: 1 })).json
  expect(program.totalWeeks).toBe(10)
  expect(program.phases.map((p) => [p.name, p.weeks, p.deload, p.routine?.id ?? null])).toEqual([
    ['Phase 1', 8, false, upper.id], ['Deload', 1, true, upper.id], ['Off', 1, false, null]
  ])
  expect(program.phases[0]!.routine).toMatchObject({ name: upper.name, dayCount: 1 })

  const off = program.phases[2]!
  program = (await apiFetch<Program>(page, 'PATCH', `/api/workouts/program-phases/${off.id}`, { sortOrder: 0, weeks: 2 })).json
  expect(program.phases.map((p) => p.name)).toEqual(['Off', 'Phase 1', 'Deload'])
  expect(program.totalWeeks).toBe(11)

  expect((await apiFetch(page, 'PATCH', `/api/workouts/program-phases/${off.id}`, { weeks: 0 })).status).toBe(400)

  program = (await apiFetch<Program>(page, 'DELETE', `/api/workouts/program-phases/${off.id}`)).json
  expect(program.phases.map((p) => p.sortOrder)).toEqual([0, 1])

  program = (await apiFetch<Program>(page, 'PATCH', `/api/workouts/programs/${created.id}`, { description: 'Bigger Leaner Stronger' })).json
  expect(program.description).toBe('Bigger Leaner Stronger')

  const copy = (await apiFetch<Program>(page, 'POST', `/api/workouts/programs/${created.id}/duplicate`)).json
  expect(copy.name).toBe(`${name} (copy)`)
  expect(copy.phases.map((p) => p.routine?.id)).toEqual([upper.id, upper.id])

  const list = (await apiFetch<ProgramSummary[]>(page, 'GET', '/api/workouts/programs')).json
  expect(list.find((p) => p.id === created.id)).toMatchObject({ phaseCount: 2, totalWeeks: 9, enrolled: false })

  expect((await apiFetch(page, 'DELETE', `/api/workouts/programs/${copy.id}`)).status).toBe(200)
  expect((await apiFetch(page, 'GET', `/api/workouts/programs/${copy.id}`)).status).toBe(404)
})

test('phases reject another user\'s routine; another user cannot see a program', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const theirs = await routineWithDay(page)
  const theirProgram = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('P ') })).json
  await registerViaApi(page, makeUser())
  const mine = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('P ') })).json
  expect((await apiFetch(page, 'POST', `/api/workouts/programs/${mine.id}/phases`, { name: 'x', weeks: 1, routineId: theirs.id })).status).toBe(400)
  expect((await apiFetch(page, 'GET', `/api/workouts/programs/${theirProgram.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'PATCH', `/api/workouts/programs/${theirProgram.id}`, { name: 'x' })).status).toBe(404)
  expect((await apiFetch(page, 'POST', `/api/workouts/programs/${theirProgram.id}/phases`, { name: 'x', weeks: 1 })).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/programs/${theirProgram.id}`)).status).toBe(404)
})
