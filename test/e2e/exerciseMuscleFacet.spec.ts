import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise } from '../../shared/types/workout'

test('the muscle facet lists the muscles left under every filter but muscles', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const none = await apiFetch<string[]>(page, 'GET', '/api/workouts/exercises/muscles?favorites=1')
  expect(none.status).toBe(200)
  expect(none.json).toEqual([])

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/favorite`)
  const favourites = (
    await apiFetch<string[]>(page, 'GET', '/api/workouts/exercises/muscles?favorites=1&muscles=calves')
  ).json
  expect(favourites).toEqual([...new Set([...bench.primaryMuscles, ...bench.secondaryMuscles])].sort())

  const everything = (await apiFetch<string[]>(page, 'GET', '/api/workouts/exercises/muscles')).json
  expect(everything.length).toBeGreaterThan(favourites.length)
})

test('the muscle facet follows the search, category and equipment filters', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const everything = (await apiFetch<string[]>(page, 'GET', '/api/workouts/exercises/muscles')).json
  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const scopes = [
    'q=barbell%20bench',
    `categoryId=${bench.category.id}`,
    `equipment=${encodeURIComponent(bench.equipment[0]!)}`
  ]
  for (const scope of scopes) {
    const listed = (await apiFetch<Exercise[]>(page, 'GET', `/api/workouts/exercises?${scope}&limit=1000`)).json
    const expected = [...new Set(listed.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles]))].sort()
    const facet = (await apiFetch<string[]>(page, 'GET', `/api/workouts/exercises/muscles?${scope}&muscles=calves`))
      .json
    expect(facet, scope).toEqual(expected)
    expect(facet.length, scope).toBeLessThan(everything.length)
  }
})
