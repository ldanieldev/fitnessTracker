import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, ExerciseCategory } from '../../shared/types/workout'

interface Reference {
  categories: ExerciseCategory[]
  muscles: { key: string }[]
  equipment: { key: string }[]
}

test('exercise reads: catalogue listing, search, filters and detail', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const categoryKeys = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'neck', 'cardio']
  expect(reference.categories.map((c) => c.key)).toEqual(categoryKeys)
  expect(reference.muscles).toHaveLength(17)
  expect(reference.equipment).toHaveLength(12)

  const all = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises')).json
  expect(all.length).toBe(876)
  expect(all.every((e) => e.shared)).toBe(true)

  const firstPage = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?limit=20')).json
  expect(firstPage.map((e) => e.id)).toEqual(all.slice(0, 20).map((e) => e.id))

  const search = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=dum%20press')).json
  expect(search.length).toBeGreaterThan(0)
  expect(search.every((e) => /dum/i.test(e.name) && /press/i.test(e.name))).toBe(true)

  const chest = reference.categories.find((c) => c.key === 'chest')!
  const byCategory = (await apiFetch<Exercise[]>(page, 'GET', `/api/workouts/exercises?categoryId=${chest.id}`)).json
  expect(byCategory.every((e) => e.category.key === 'chest')).toBe(true)

  const byMuscle = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?muscles=lats')).json
  expect(byMuscle.every((e) => e.primaryMuscles.includes('lats') || e.secondaryMuscles.includes('lats'))).toBe(true)

  const bench = search[0]!
  const detailUrl = `/api/workouts/exercises/${bench.id}`
  const detail = (await apiFetch<Exercise & { instructions: string[] }>(page, 'GET', detailUrl)).json
  expect(detail.id).toBe(bench.id)
  expect(Array.isArray(detail.instructions)).toBe(true)

  expect((await apiFetch(page, 'GET', '/api/workouts/exercises/99999999')).status).toBe(404)
})
