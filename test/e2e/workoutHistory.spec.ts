import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, ExerciseHistorySession, WorkoutSession } from '../../shared/types/workout'

test('workout history: newest first, records and totals, paged by limit', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const log = async (performedOn: string, weight: number) => {
    const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
      exerciseId: bench.id
    })).json.entries[0]!
    await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight, reps: 5 })
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
    return session.id
  }

  const older = await log('2026-02-01', 185)
  const newer = await log('2026-02-08', 205)

  const all = (
    await apiFetch<ExerciseHistorySession[]>(page, 'GET', `/api/workouts/exercises/${bench.id}/history`)
  ).json
  expect(all.map((s) => s.sessionId)).toEqual([newer, older])
  expect(all[0]!.totals).toMatchObject({ sets: 1, volume: 205 * 5, topWeight: 205, topWeightReps: 5 })
  expect(all[0]!.sets[0]!.records).toEqual([{ kind: 'weight_reps', previous: 185 }])
  expect(all[1]!.sets[0]!.records).toEqual([])

  const paged = (
    await apiFetch<ExerciseHistorySession[]>(page, 'GET', `/api/workouts/exercises/${bench.id}/history?limit=1`)
  ).json
  expect(paged.map((s) => s.sessionId)).toEqual([newer])
})
