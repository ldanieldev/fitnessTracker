import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, ExerciseSeries, WorkoutSession } from '../../shared/types/workout'

const today = new Date().toISOString().slice(0, 10)

test('workout series: metrics, validation and incremental rollups matching a rebuild', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const first = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-01-05'
  })).json
  const firstEntry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${first.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${firstEntry.id}/sets`, { weight: 185, reps: 8 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${firstEntry.id}/sets`, { weight: 205, reps: 5 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${first.id}`, { finish: true })

  const url = (metric: string, extra = '') => (
    `/api/workouts/exercises/${bench.id}/series?metric=${metric}&from=2026-01-01&to=${today}${extra}`
  )

  const volume = (await apiFetch<ExerciseSeries>(page, 'GET', url('volume'))).json
  expect(volume.points).toEqual([{ date: '2026-01-05', value: 185 * 8 + 205 * 5 }])

  const maxWeight = (await apiFetch<ExerciseSeries>(page, 'GET', url('max_weight'))).json
  expect(maxWeight.points[0]!.value).toBe(205)

  const atReps = (await apiFetch<ExerciseSeries>(page, 'GET', url('weight_at_reps', '&reps=8'))).json
  expect(atReps.points[0]!.value).toBe(185)

  expect((await apiFetch(page, 'GET', url('weight_at_reps'))).status).toBe(400)
  expect((await apiFetch(page, 'GET', url('pace'))).status).toBe(400)
  const reversedUrl = `/api/workouts/exercises/${bench.id}/series?metric=volume&from=${today}&to=2026-01-01`
  expect((await apiFetch(page, 'GET', reversedUrl)).status).toBe(400)

  // Editing a set, moving the session and rebuilding must all land on the same numbers.
  const sets = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${first.id}`)).json.entries[0]!.sets
  await apiFetch(page, 'PATCH', `/api/workouts/sets/${sets[1]!.id}`, { weight: 225 })
  expect((await apiFetch<ExerciseSeries>(page, 'GET', url('max_weight'))).json.points[0]!.value).toBe(225)

  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${first.id}`, { performedOn: '2026-01-09' })
  expect((await apiFetch<ExerciseSeries>(page, 'GET', url('max_weight'))).json.points[0]!.date).toBe('2026-01-09')

  const before = (await apiFetch<ExerciseSeries>(page, 'GET', url('volume'))).json.points
  await apiFetch(page, 'POST', '/api/workouts/rollups/rebuild')
  expect((await apiFetch<ExerciseSeries>(page, 'GET', url('volume'))).json.points).toEqual(before)

  await apiFetch(page, 'DELETE', `/api/workouts/sets/${sets[0]!.id}`)
  await apiFetch(page, 'DELETE', `/api/workouts/sets/${sets[1]!.id}`)
  expect((await apiFetch<ExerciseSeries>(page, 'GET', url('volume'))).json.points).toEqual([])
})

test('workout series: duplicate entries for one exercise in one session aggregate and survive a partial delete', async (
  { page, goto }
) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-02-01'
  })).json
  const entryA = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  const entryB = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[1]!

  await apiFetch(page, 'POST', `/api/workouts/entries/${entryA.id}/sets`, { weight: 135, reps: 10 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entryB.id}/sets`, { weight: 145, reps: 6 })

  const url = `/api/workouts/exercises/${bench.id}/series?metric=volume&from=2026-01-01&to=${today}`
  const combined = (await apiFetch<ExerciseSeries>(page, 'GET', url)).json
  expect(combined.points).toEqual([{ date: '2026-02-01', value: 135 * 10 + 145 * 6 }])

  await apiFetch(page, 'DELETE', `/api/workouts/entries/${entryA.id}`)
  const afterDelete = (await apiFetch<ExerciseSeries>(page, 'GET', url)).json
  expect(afterDelete.points).toEqual([{ date: '2026-02-01', value: 145 * 6 }])
})

test('workout series: raising the rep cap rebuilds the stored e1rm', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-03-01'
  })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 100, reps: 12 })

  const url = `/api/workouts/exercises/${bench.id}/series?metric=e1rm&from=2026-01-01&to=${today}`
  const capped = (await apiFetch<ExerciseSeries>(page, 'GET', url)).json
  expect(capped.points).toEqual([])

  const userId = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { oneRepMaxRepCap: 12 })).status).toBe(200)

  const raised = (await apiFetch<ExerciseSeries>(page, 'GET', url)).json
  expect(raised.points).toHaveLength(1)
  expect(raised.points[0]!.value).toBeCloseTo(144, 0)
})

test('workout series: a weight_at_reps goal only draws when the requested reps match', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-04-01'
  })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 5 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, {
    metric: 'weight_at_reps', targetValue: 200, targetReps: 5
  })

  const url = (reps: number) => (
    `/api/workouts/exercises/${bench.id}/series?metric=weight_at_reps&reps=${reps}&from=2026-01-01&to=${today}`
  )

  const atGoalReps = (await apiFetch<ExerciseSeries>(page, 'GET', url(5))).json
  expect(atGoalReps.goal?.targetReps).toBe(5)

  const atOtherReps = (await apiFetch<ExerciseSeries>(page, 'GET', url(8))).json
  expect(atOtherReps.goal).toBeNull()
})
