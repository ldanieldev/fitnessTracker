import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, WorkoutProgress, WorkoutSession } from '../../shared/types/workout'

const today = new Date().toISOString().slice(0, 10)

test('workout progress: totals, muscle volume and goals', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
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
