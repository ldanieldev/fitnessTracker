import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise } from '../../shared/types/workout'

interface Reference {
  categories: { id: number; key: string }[]
}

test('a misspelled search is rescued by the search index', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = `${uniquePrefix('Rescue')} Blorptastic Row`

  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const core = reference.categories.find((c) => c.key === 'core')!
  const created = await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name,
    categoryId: core.id,
    trackingType: 'reps'
  })
  expect(created.status).toBe(200)

  const rebuilt = (await apiFetch<{ skipped: boolean }>(page, 'POST', '/api/workouts/_test/search-rebuild')).json
  test.skip(rebuilt.skipped, 'Meilisearch is not configured; nothing to rescue with')

  const rescued = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=blorptastik')).json
  expect(rescued.map((e) => e.id)).toEqual([created.json.id])
  const url = '/api/workouts/exercises?q=blorptastik&categoryId=99999999'
  expect((await apiFetch<Exercise[]>(page, 'GET', url)).json).toEqual([])
})

test('the rescue fills only a text miss, favourites first', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const prefix = uniquePrefix('Rescue')
  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const core = reference.categories.find((c) => c.key === 'core')!
  const make = async (name: string) =>
    (
      await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
        name: `${prefix} ${name}`,
        categoryId: core.id,
        trackingType: 'reps'
      })
    ).json
  const alpha = await make('Zibblequartz Alpha')
  const zulu = await make('Zibblequartz Zulu')
  const press = await make('Zibblequarts Press')
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${zulu.id}/favorite`)

  const rebuilt = (await apiFetch<{ skipped: boolean }>(page, 'POST', '/api/workouts/_test/search-rebuild')).json
  test.skip(rebuilt.skipped, 'Meilisearch is not configured; nothing to rescue with')

  const rescued = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=zibblequartx')).json
  expect(rescued[0]!.id).toBe(zulu.id)
  expect(rescued.map((e) => e.id)).toEqual(expect.arrayContaining([alpha.id, press.id]))

  const filtered = await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=zibblequarts&favorites=1')
  expect(filtered.json).toEqual([])
})
