import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, ExerciseRecords, WorkoutSession } from '../../shared/types/workout'

interface Reference { categories: { id: number, key: string }[] }

test('workout records: headlines and the rep-max table', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const empty = (await apiFetch<ExerciseRecords>(page, 'GET', `/api/workouts/exercises/${bench.id}/records`)).json
  expect(empty.highlights.every((h) => h.value === null)).toBe(true)
  expect(empty.repMax).toHaveLength(15)
  expect(empty.repMax[0]!.weight).toBeNull()

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 8 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 225, reps: 3 })

  const records = (await apiFetch<ExerciseRecords>(page, 'GET', `/api/workouts/exercises/${bench.id}/records`)).json
  const byKind = Object.fromEntries(records.highlights.map((h) => [h.kind, h]))
  expect(byKind.max_weight!.value).toBe(225)
  expect(byKind.max_weight!.reps).toBe(3)
  expect(byKind.max_weight!.sessionId).toBe(session.id)
  expect(byKind.set_volume!.value).toBe(185 * 8)
  expect(byKind.session_volume!.value).toBe(185 * 8 + 225 * 3)
  expect(byKind.e1rm!.value).toBeCloseTo(238.2, 0)

  expect(records.repMax[7]!).toMatchObject({ reps: 8, weight: 185 })
  expect(records.repMax[2]!).toMatchObject({ reps: 3, weight: 225 })
  expect(records.repMax[4]!.weight).toBeNull()
  expect(records.repMax[11]!.estimate).toBeNull() // 12 reps, above the default cap of 10
})

test('workout records: the rep cap suppresses the estimate on a row that actually exists', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 100, reps: 8 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 100, reps: 12 })

  const records = (await apiFetch<ExerciseRecords>(page, 'GET', `/api/workouts/exercises/${bench.id}/records`)).json

  // 12 reps is above the default cap of 10: the row is real (weight/date/session set) but carries no estimate.
  expect(records.repMax[11]).toMatchObject({ reps: 12, weight: 100, performedOn: session.performedOn })
  expect(records.repMax[11]!.sessionId).toBe(session.id)
  expect(records.repMax[11]!.estimate).toBeNull()

  // 8 reps is at/under the cap on the same real row: it does carry an estimate.
  expect(records.repMax[7]).toMatchObject({ reps: 8, weight: 100, estimate: 124.1 })
})

test('workout records: an assisted exercise inverts "better" and never carries an estimate', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const core = reference.categories.find((c) => c.key === 'core')!
  const assisted = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Assisted Dip '),
    categoryId: core.id,
    trackingType: 'weight_reps',
    loadStyle: 'assisted'
  })).json

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: assisted.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 40, reps: 6 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 20, reps: 5 })

  const records = (await apiFetch<ExerciseRecords>(page, 'GET', `/api/workouts/exercises/${assisted.id}/records`)).json
  const byKind = Object.fromEntries(records.highlights.map((h) => [h.kind, h]))

  expect(records.assisted).toBe(true)
  // Less assistance (a lower weight) is the better result, so 20 lb beats 40 lb.
  expect(byKind.max_weight!.value).toBe(20)
  expect(byKind.max_weight!.reps).toBe(5)
  expect(records.repMax.every((row) => row.estimate === null)).toBe(true)
  expect(records.repMax[4]!.weight).toBe(20)
  expect(records.repMax[5]!.weight).toBe(40)
})
