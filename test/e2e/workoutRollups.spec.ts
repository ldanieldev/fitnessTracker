import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, WorkoutSession } from '../../shared/types/workout'

test('workout rollups: written on every set path and rebuildable', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() }))
    .json
  const entry = (
    await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
      exerciseId: bench.id
    })
  ).json.entries[0]!

  expect((await apiFetch<{ rows: number }>(page, 'POST', '/api/workouts/rollups/rebuild')).json.rows).toBe(0)

  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 8 })
  expect((await apiFetch<{ rows: number }>(page, 'POST', '/api/workouts/rollups/rebuild')).json.rows).toBe(1)

  await apiFetch(page, 'DELETE', `/api/workouts/entries/${entry.id}`)
  expect((await apiFetch<{ rows: number }>(page, 'POST', '/api/workouts/rollups/rebuild')).json.rows).toBe(0)
})
