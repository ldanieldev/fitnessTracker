import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, WorkoutGoal, WorkoutProgress, WorkoutSession, WorkoutSet } from '../../shared/types/workout'

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

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
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

test('workout goals: Reached follows the sessions that earned it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const log = async (performedOn: string, weight: number) => {
    const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
      exerciseId: bench.id
    })).json.entries[0]!
    const set = (await apiFetch<{ set: WorkoutSet }>(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, {
      weight, reps: 3
    })).json.set
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
    return { sessionId: session.id, setId: set.id }
  }
  const goal = async () =>
    (await apiFetch<WorkoutProgress>(page, 'GET', '/api/workouts/progress?from=2026-01-01&to=2026-12-31')).json.goals[0]!

  const first = await log('2026-03-02', 230)
  const second = await log('2026-03-09', 230)
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/goal`, { metric: 'max_weight', targetValue: 225 })
  expect((await goal()).achievedAt).not.toBeNull()

  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${first.sessionId}`)
  expect(await goal()).toMatchObject({ reached: true })

  await apiFetch(page, 'DELETE', `/api/workouts/sets/${second.setId}`)
  expect(await goal()).toMatchObject({ reached: false, achievedAt: null, current: null })

  const third = await log('2026-03-16', 235)
  expect(await goal()).toMatchObject({ reached: true })
  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${third.sessionId}`)
  expect(await goal()).toMatchObject({ reached: false, achievedAt: null })
})
