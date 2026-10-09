import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Program } from '../../shared/types/program'
import type { Routine } from '../../shared/types/routine'
import type { WorkoutSession } from '../../shared/types/workout'

test('a session in a deload phase reports deload; others do not', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('PG R ') })).json
  await apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name: 'A' })
  const program = (await apiFetch<Program>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('PG P ') })).json
  await apiFetch(page, 'POST', `/api/workouts/programs/${program.id}/phases`, { name: 'Build', weeks: 1, routineId: routine.id })
  await apiFetch(page, 'POST', `/api/workouts/programs/${program.id}/phases`, { name: 'Deload', weeks: 1, routineId: routine.id, deload: true })
  await apiFetch(page, 'POST', `/api/workouts/programs/${program.id}/enroll`, { when: 'now', today: '2026-01-05' })

  const start = async (performedOn: string) => {
    const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
    return (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${session.id}`)).json
  }
  expect((await start('2026-01-06')).deload).toBe(false)
  expect((await start('2026-01-13')).deload).toBe(true)

  await apiFetch(page, 'POST', '/api/workouts/enrollment/pause', { today: '2026-01-14' })
  expect((await start('2026-01-14')).deload).toBe(false)
})
