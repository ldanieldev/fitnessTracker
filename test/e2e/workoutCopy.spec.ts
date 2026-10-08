import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../shared/types/workout'

test('copying a workout brings exercises without sets, and deleting an account with logged sets works',
  async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    const user = makeUser()
    await registerViaApi(page, user)

    const core = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
      .json.categories.find((c) => c.key === 'core')!
    const mine = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
      name: uniquePrefix('Copy Test '), categoryId: core.id, trackingType: 'reps'
    })).json

    const source = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
    const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${source.id}/entries`, {
      exerciseId: mine.id
    })).json.entries[0]!
    await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { reps: 12 })
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${source.id}`, { finish: true })

    const copy = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), copyFromId: source.id })
    expect(copy.status).toBe(200)
    expect(copy.json.entries.map((e) => e.exerciseId)).toEqual([mine.id])
    expect(copy.json.entries[0]!.sets).toEqual([])
    expect(copy.json.entries[0]!.lastSets).toEqual([{ reps: 12 }])

    const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
    expect((await apiFetch(page, 'DELETE', `/api/users/${session.json.user.id}`)).status).toBe(200)
  })
