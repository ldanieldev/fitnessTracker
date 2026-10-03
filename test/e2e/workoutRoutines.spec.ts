import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Routine, RoutineSummary } from '../../shared/types/routine'
import type { Exercise, ExerciseCategory } from '../../shared/types/workout'

async function newRoutine(page: Page, name = uniquePrefix('Routine ')) {
  return (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name })).json
}

test('routine CRUD without days', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  expect(routine).toMatchObject({ active: false, nextDayId: null, days: [] })

  const renamed = await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { name: 'Upper/Lower', notes: 'BLS' })
  expect(renamed.json).toMatchObject({ name: 'Upper/Lower', notes: 'BLS' })

  const noDays = await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { active: true })
  expect(noDays.status).toBe(400)

  const list = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
  expect(list.find((r) => r.id === routine.id)).toMatchObject({ dayCount: 0, nextDay: null, active: false })

  expect((await apiFetch(page, 'DELETE', `/api/workouts/routines/${routine.id}`)).status).toBe(200)
  expect((await apiFetch(page, 'GET', `/api/workouts/routines/${routine.id}`)).status).toBe(404)
})

test('another user cannot see or change a routine', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  await registerViaApi(page, makeUser())
  expect((await apiFetch(page, 'GET', `/api/workouts/routines/${routine.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { name: 'x' })).status).toBe(404)
  expect((await apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/skip`)).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/routines/${routine.id}`)).status).toBe(404)
})

async function exercise(page: Page, trackingType = 'weight_reps') {
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  return (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Routine Ex '), categoryId: chest.id, trackingType, loadStyle: 'plain'
  })).json
}

async function addDay(page: Page, routineId: number, name: string, floating = false) {
  return (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routineId}/days`, { name, floating })).json
}

test('days: order, floating, pointer, skip, make next, activate, duplicate', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  await addDay(page, routine.id, 'Upper A')
  await addDay(page, routine.id, 'Pump', true)
  let current = await addDay(page, routine.id, 'Lower A')
  const [upper, pump, lower] = current.days.map((d) => d.id) as [number, number, number]
  expect(current.nextDayId).toBe(upper)

  const floatingNext = await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: pump })
  expect(floatingNext.status).toBe(400)

  current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/skip`)).json
  expect(current.nextDayId).toBe(lower)
  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: upper })).json
  expect(current.nextDayId).toBe(upper)

  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routine-days/${lower}`, { sortOrder: 0, description: 'Squat focus' })).json
  expect(current.days.map((d) => d.id)).toEqual([lower, upper, pump])
  expect(current.days[0]!.description).toBe('Squat focus')

  current = (await apiFetch<Routine>(page, 'DELETE', `/api/workouts/routine-days/${upper}`)).json
  expect(current.nextDayId).toBe(lower)

  const other = await newRoutine(page)
  await addDay(page, other.id, 'Only')
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { active: true })
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${other.id}`, { active: true })
  const list = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
  expect(list.filter((r) => r.active).map((r) => r.id)).toEqual([other.id])

  const copy = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/duplicate`)).json
  expect(copy.name.endsWith('(copy)')).toBe(true)
  expect(copy.active).toBe(false)
  expect(copy.days.map((d) => d.name)).toEqual(['Lower A', 'Pump'])
})

test('routine exercises: targets, range check, groups, reorder, deleted exercises', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  const dayId = (await addDay(page, routine.id, 'Day')).days[0]!.id
  const ex = [await exercise(page), await exercise(page), await exercise(page), await exercise(page, 'time')]
  let current = routine
  for (const e of ex) {
    current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId: e.id })).json
  }
  const entries = current.days[0]!.entries
  expect(entries[0]!.target).toEqual({ sets: 3, low: null, high: null, weight: null })
  const [a, b, c, plank] = entries.map((e) => e.id) as [number, number, number, number]

  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routine-entries/${a}`, {
    targetLow: 5, targetHigh: 8, restSeconds: 180, optional: true, notes: 'per side'
  })).json
  expect(current.days[0]!.entries[0]).toMatchObject({
    target: { sets: 3, low: 5, high: 8, weight: null }, restSeconds: 180, optional: true, notes: 'per side'
  })
  expect(current.days[0]!.entries[3]!.trackingType).toBe('time')
  expect((await apiFetch(page, 'PATCH', `/api/workouts/routine-entries/${a}`, { targetLow: 9 })).status).toBe(400)

  current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayId}/group`, { entryIds: [a, c] })).json
  expect(current.days[0]!.entries.map((e) => e.id)).toEqual([a, c, b, plank])
  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routine-entries/${b}`, { sortOrder: 0 })).json
  expect(current.days[0]!.entries.map((e) => e.id)).toEqual([b, a, c, plank])

  await apiFetch(page, 'DELETE', `/api/workouts/exercises/${ex[2]!.id}`)
  current = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json
  expect(current.days[0]!.entries.find((e) => e.id === c)!.deleted).toBe(true)

  current = (await apiFetch<Routine>(page, 'DELETE', `/api/workouts/routine-entries/${c}`)).json
  expect(current.days[0]!.entries.find((e) => e.id === a)!.supersetGroup).toBeNull()
  expect(current.days[0]!.entries.map((e) => e.sortOrder)).toEqual([0, 1, 2])

  const deletedAdd = await apiFetch(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId: ex[2]!.id })
  expect(deletedAdd.status).toBe(404)
})
