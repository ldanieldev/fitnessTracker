import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, WorkoutSession } from '../../shared/types/workout'

test('workout entries: add, reorder, annotate and remove exercises', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const squat = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20squat')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json

  const first = await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })
  expect(first.json.entries).toHaveLength(1)
  expect(first.json.entries[0]!.exerciseName).toBe(bench.name)
  expect(first.json.entries[0]!.trackingType).toBe(bench.trackingType)
  expect(first.json.entries[0]!.sets).toEqual([])

  const both = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: squat.id
  })).json
  expect(both.entries.map((e) => e.exerciseId)).toEqual([bench.id, squat.id])

  const reordered = await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/entries/${both.entries[1]!.id}`, {
    sortOrder: 0
  })
  expect(reordered.json.entries.map((e) => e.exerciseId)).toEqual([squat.id, bench.id])

  const annotated = await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/entries/${both.entries[0]!.id}`, {
    notes: 'paused reps'
  })
  expect(annotated.json.entries.find((e) => e.exerciseId === bench.id)!.notes).toBe('paused reps')

  const removed = await apiFetch<WorkoutSession>(page, 'DELETE', `/api/workouts/entries/${both.entries[0]!.id}`)
  expect(removed.json.entries.map((e) => e.exerciseId)).toEqual([squat.id])

  expect((await apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: 99999999
  })).status).toBe(404)
  expect((await apiFetch(page, 'PATCH', '/api/workouts/entries/99999999', { sortOrder: 0 })).status).toBe(404)
})

test('adding exercises appends in order, and another user\'s workout is not found', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const squat = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20squat')).json[0]!
  const mine = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-03-02' })).json
  let session = mine
  for (const exercise of [bench, squat, bench]) {
    session = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${mine.id}/entries`, { exerciseId: exercise.id })).json
  }
  expect(session.entries.map((e) => e.sortOrder)).toEqual([0, 1, 2])
  expect(session.entries.map((e) => e.exerciseId)).toEqual([bench.id, squat.id, bench.id])
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${mine.id}`, { finish: true })

  await registerViaApi(page, makeUser())
  expect((await apiFetch(page, 'POST', `/api/workouts/sessions/${mine.id}/entries`, { exerciseId: bench.id })).status).toBe(404)
  const ids = session.entries.slice(0, 2).map((e) => e.id)
  expect((await apiFetch(page, 'POST', `/api/workouts/sessions/${mine.id}/group`, { entryIds: ids })).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/sessions/${mine.id}`)).status).toBe(404)
})
