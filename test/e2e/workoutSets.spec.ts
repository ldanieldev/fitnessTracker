import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, WorkoutSession, WorkoutSet } from '../../shared/types/workout'

interface SetResponse { session: WorkoutSession, set: WorkoutSet }

test('workout sets: log, validate, record, edit and delete', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const first = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  const entryId = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${first.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!.id

  const opener = await apiFetch<SetResponse>(page, 'POST', `/api/workouts/entries/${entryId}/sets`, {
    weight: 185, reps: 8
  })
  expect(opener.status).toBe(200)
  expect(opener.json.set.records).toEqual([{ kind: 'weight_reps', previous: null }])
  expect(opener.json.session.entries[0]!.sets).toHaveLength(1)

  const missing = await apiFetch(page, 'POST', `/api/workouts/entries/${entryId}/sets`, { weight: 185 })
  expect(missing.status).toBe(400)

  const wrongMeasure = await apiFetch(page, 'POST', `/api/workouts/entries/${entryId}/sets`, {
    weight: 185, reps: 8, distanceMeters: 100
  })
  expect(wrongMeasure.status).toBe(400)

  const heavier = await apiFetch<SetResponse>(page, 'POST', `/api/workouts/entries/${entryId}/sets`, {
    weight: 195, reps: 8
  })
  expect(heavier.json.set.records).toEqual([{ kind: 'weight_reps', previous: 185 }])

  const corrected = await apiFetch<SetResponse>(page, 'PATCH', `/api/workouts/sets/${heavier.json.set.id}`, {
    weight: 135
  })
  expect(corrected.json.set.records).toEqual([])
  expect(corrected.json.session.entries[0]!.sets[0]!.records).toEqual([{ kind: 'weight_reps', previous: null }])

  const ticked = await apiFetch<SetResponse>(page, 'PATCH', `/api/workouts/sets/${opener.json.set.id}`, {
    done: true, comment: 'easy'
  })
  expect(ticked.json.set.done).toBe(true)
  expect(ticked.json.set.comment).toBe('easy')

  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${first.id}`, { finish: true })

  const second = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  const secondEntry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${second.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  expect(secondEntry.lastSets).toEqual([{ weight: 185, reps: 8 }, { weight: 135, reps: 8 }])

  const removed = await apiFetch<WorkoutSession>(page, 'DELETE', `/api/workouts/sets/${opener.json.set.id}`)
  expect(removed.json.entries).toHaveLength(1)
  expect((await apiFetch(page, 'PATCH', '/api/workouts/sets/99999999', { done: true })).status).toBe(404)
})

test('workout sets: cardio measures round-trip and take the pace record', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const exercises = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=running')).json
  const cardio = exercises.find((exercise) => exercise.trackingType === 'distance_time')!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  const entryId = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: cardio.id
  })).json.entries[0]!.id

  const opener = await apiFetch<SetResponse>(page, 'POST', `/api/workouts/entries/${entryId}/sets`, {
    distanceMeters: 5000, durationSeconds: 1800
  })
  expect(opener.status).toBe(200)
  expect(opener.json.set.distanceMeters).toBe(5000)
  expect(opener.json.set.durationSeconds).toBe(1800)
  expect(opener.json.set.records).toEqual([{ kind: 'distance', previous: null }, { kind: 'pace', previous: null }])

  const faster = await apiFetch<SetResponse>(page, 'POST', `/api/workouts/entries/${entryId}/sets`, {
    distanceMeters: 5000, durationSeconds: 1500
  })
  expect(faster.json.set.records).toEqual([{ kind: 'pace', previous: 5000 / 1800 }])

  const wrongMeasure = await apiFetch(page, 'POST', `/api/workouts/entries/${entryId}/sets`, { weight: 100 })
  expect(wrongMeasure.status).toBe(400)

  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
})
