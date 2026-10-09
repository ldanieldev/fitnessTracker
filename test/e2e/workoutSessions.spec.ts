import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { WorkoutSession, WorkoutSessionSummary } from '../../shared/types/workout'

test('workout sessions: start, resume, finish, move, list and delete', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Push Day ')

  expect((await apiFetch<WorkoutSession | null>(page, 'GET', '/api/workouts/sessions/active')).json).toBe(null)

  const started = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), name })
  expect(started.status).toBe(200)
  expect(started.json.endedAt).toBe(null)
  expect(started.json.entries).toEqual([])
  const id = started.json.id

  expect((await apiFetch<WorkoutSession>(page, 'GET', '/api/workouts/sessions/active')).json.id).toBe(id)

  const second = await apiFetch<{ data: { session: WorkoutSession } }>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })
  expect(second.status).toBe(409)

  const moved = await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/sessions/${id}`, {
    performedOn: '2026-01-02',
    notes: 'felt strong'
  })
  expect(moved.json.performedOn).toBe('2026-01-02')
  expect(moved.json.notes).toBe('felt strong')

  const finished = await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/sessions/${id}`, { finish: true })
  expect(finished.json.endedAt).not.toBe(null)
  expect((await apiFetch<WorkoutSession | null>(page, 'GET', '/api/workouts/sessions/active')).json).toBe(null)

  const next = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })
  expect(next.status).toBe(200)

  const list = (await apiFetch<WorkoutSessionSummary[]>(page, 'GET', '/api/workouts/sessions')).json
  expect(list.map((s) => s.id)).toContain(id)
  expect(list.find((s) => s.id === id)!.name).toBe(name)
  expect(list.find((s) => s.id === id)!.setCount).toBe(0)

  expect((await apiFetch(page, 'DELETE', `/api/workouts/sessions/${next.json.id}`)).json).toEqual({ ok: true })
  expect((await apiFetch(page, 'GET', `/api/workouts/sessions/${next.json.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/99999999')).status).toBe(404)
})

test('workout sessions: change the start and end times (LG-R21)', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const id = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json.id
  const startedAt = '2026-01-02T15:00:00.000Z'
  const endedAt = '2026-01-02T16:30:00.000Z'

  const timed = await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/sessions/${id}`, { startedAt, endedAt })
  expect(timed.status).toBe(200)
  expect(timed.json.startedAt).toBe(startedAt)
  expect(timed.json.endedAt).toBe(endedAt)

  const read = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${id}`)).json
  expect(read.startedAt).toBe(startedAt)
  expect(read.endedAt).toBe(endedAt)

  const reversed = await apiFetch(page, 'PATCH', `/api/workouts/sessions/${id}`, { startedAt: endedAt, endedAt: startedAt })
  expect(reversed.status).toBe(400)

  const future = new Date(Date.now() + 86_400_000).toISOString()
  const finishedBeforeStart = await apiFetch(page, 'PATCH', `/api/workouts/sessions/${id}`, { startedAt: future, finish: true })
  expect(finishedBeforeStart.status).toBe(400)

  const reopened = await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/sessions/${id}`, { endedAt: null })
  expect(reopened.json.endedAt).toBe(null)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/sessions/${id}`)).json).toEqual({ ok: true })
})

test('a second open workout is refused with the open one, from start and from reopen', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const first = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-02-02' })).json
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${first.id}`, { finish: true })
  const second = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-02-03' })).json

  const started = await apiFetch<{ data: { session: WorkoutSession } }>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-02-03' })
  expect(started.status).toBe(409)
  expect(started.json.data.session.id).toBe(second.id)

  const reopened = await apiFetch<{ data: { session: WorkoutSession } }>(page, 'PATCH', `/api/workouts/sessions/${first.id}`, { endedAt: null })
  expect(reopened.status).toBe(409)
  expect(reopened.json.data.session.id).toBe(second.id)

  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${second.id}`, { finish: true })
})
