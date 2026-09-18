import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise } from '../../shared/types/workout'

interface Reference { categories: { id: number, key: string }[] }

test('a misspelled search is rescued by the search index', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = `${uniquePrefix('Rescue')} Blorptastic Row`

  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const core = reference.categories.find((c) => c.key === 'core')!
  const created = await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name, categoryId: core.id, trackingType: 'reps'
  })
  expect(created.status).toBe(200)

  const rebuilt = (await apiFetch<{ skipped: boolean }>(page, 'POST', '/api/workouts/_test/search-rebuild')).json
  test.skip(rebuilt.skipped, 'Meilisearch is not configured; nothing to rescue with')

  const rescued = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=blorptastik')).json
  expect(rescued.map((e) => e.id)).toEqual([created.json.id])
  const url = '/api/workouts/exercises?q=blorptastik&categoryId=99999999'
  expect((await apiFetch<Exercise[]>(page, 'GET', url)).json).toEqual([])
})
