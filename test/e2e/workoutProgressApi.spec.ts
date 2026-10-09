import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, ExerciseCategory, WorkoutProgress, WorkoutSession } from '../../shared/types/workout'

const today = todayDate()

test('workout progress: totals, muscle volume and goals', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 8 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 6 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, { metric: 'max_weight', targetValue: 225 })

  const url = `/api/workouts/progress?from=2026-01-01&to=${today}`
  const progress = (await apiFetch<WorkoutProgress>(page, 'GET', url)).json
  expect(progress.totals).toMatchObject({ workouts: 1, sets: 2, reps: 14, volume: 185 * 14 })
  expect(progress.totals.durationSeconds).toBeGreaterThanOrEqual(0)
  expect(progress.muscles.length).toBeGreaterThan(0)
  expect(progress.muscles[0]!.volume).toBe(185 * 14)
  expect(progress.goals).toHaveLength(1)
  expect(progress.goals[0]).toMatchObject({
    metric: 'max_weight', targetValue: 225, current: 185, lowerIsBetter: false, reached: false
  })

  expect((await apiFetch(page, 'GET', `/api/workouts/progress?from=${today}&to=2026-01-01`)).status).toBe(400)
})

test('workout progress: a missing from falls back to the earliest rollup, not the current month', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-01-05'
  })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 8 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })

  const progress = (await apiFetch<WorkoutProgress>(page, 'GET', `/api/workouts/progress?to=${today}`)).json
  expect(progress.from).toBe('2026-01-05')
  expect(progress.totals.workouts).toBe(1)
})

test('workout progress: the time tile counts only workouts that have sets', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const day = '2026-03-02'
  const trained = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: day })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${trained.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 5 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${trained.id}`, {
    startedAt: `${day}T15:00:00.000Z`, endedAt: `${day}T15:30:00.000Z`
  })
  const empty = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: day })).json
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${empty.id}`, {
    startedAt: `${day}T16:00:00.000Z`, endedAt: `${day}T17:00:00.000Z`
  })

  const progress = (await apiFetch<WorkoutProgress>(page, 'GET', `/api/workouts/progress?from=${day}&to=${day}`)).json
  expect(progress.totals).toMatchObject({ workouts: 1, durationSeconds: 1800 })
})

test('workout progress: goals on a deleted exercise drop out', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const cats = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json.categories
  const custom = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('GoalGone '), categoryId: cats[0]!.id, trackingType: 'weight_reps', loadStyle: 'plain'
  })).json
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${custom.id}/goal`, { metric: 'max_weight', targetValue: 100 })
  const url = `/api/workouts/progress?from=2026-01-01&to=${today}`
  expect((await apiFetch<WorkoutProgress>(page, 'GET', url)).json.goals.map((g) => g.exerciseId)).toContain(custom.id)

  expect((await apiFetch(page, 'DELETE', `/api/workouts/exercises/${custom.id}`)).status).toBe(200)
  expect((await apiFetch<WorkoutProgress>(page, 'GET', url)).json.goals.map((g) => g.exerciseId)).not.toContain(custom.id)
})

test('workout progress: an assisted goal with no sessions still reads lower-is-better', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const cats = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json.categories
  const assisted = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('AssistGoal '), categoryId: cats[0]!.id, trackingType: 'weight_reps', loadStyle: 'assisted'
  })).json
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${assisted.id}/goal`, { metric: 'max_weight', targetValue: 20 })

  const progress = (await apiFetch<WorkoutProgress>(page, 'GET', `/api/workouts/progress?from=2026-01-01&to=${today}`)).json
  expect(progress.goals.find((g) => g.exerciseId === assisted.id)).toMatchObject({ current: null, lowerIsBetter: true })
})
