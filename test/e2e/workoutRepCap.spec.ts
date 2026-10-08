import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, OneRepMaxResult, WorkoutSession } from '../../shared/types/workout'

test('rep cap: bounds the estimate and a raise is not served from a stale cache', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 100, reps: 12 })

  const today = todayDate()
  const url = `/api/workouts/exercises/${bench.id}/one-rep-max?on=${today}`
  const capped = await apiFetch<OneRepMaxResult>(page, 'GET', url)
  expect(capped.json.estimate).toBeNull()

  const userId = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { oneRepMaxRepCap: 12 })).status).toBe(200)

  const raised = await apiFetch<OneRepMaxResult>(page, 'GET', url)
  expect(raised.json.estimate).toBeCloseTo(144, 0)
})

test('rep cap: a profile PUT that omits it leaves the stored cap unchanged', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const userId = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { oneRepMaxRepCap: 15 })).status).toBe(200)

  // Mirrors the client's canEditRepCap guard: a save from a session that never carries the field must not clobber it.
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { defaultRestSeconds: 90 })).status).toBe(200)

  const session = await apiFetch<{ user: { oneRepMaxRepCap: number } }>(page, 'GET', '/api/_auth/session')
  expect(session.json.user.oneRepMaxRepCap).toBe(15)
})
