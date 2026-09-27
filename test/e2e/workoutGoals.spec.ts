import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, WorkoutGoal, WorkoutSession } from '../../shared/types/workout'

test('workout goals: set, validate, stamp and remove', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!

  const set = await apiFetch<WorkoutGoal>(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, {
    metric: 'max_weight', targetValue: 225, targetDate: '2026-12-31'
  })
  expect(set.status).toBe(200)
  expect(set.json.achievedAt).toBeNull()

  const needsReps = await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, {
    metric: 'weight_at_reps', targetValue: 185
  })
  expect(needsReps.status).toBe(400)

  const wrongMetric = await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, {
    metric: 'pace', targetValue: 3
  })
  expect(wrongMetric.status).toBe(400)

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 230, reps: 3 })

  const stamped = await apiFetch<WorkoutGoal>(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, {
    metric: 'max_weight', targetValue: 225
  })
  expect(stamped.json.achievedAt).not.toBeNull()

  const deleted = await apiFetch(page, 'DELETE', `/api/workouts/exercises/${bench.id}/goal?metric=max_weight`)
  expect(deleted.status).toBe(200)
})
