import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('a new user is seeded with Meal 1-5 and Snack', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const list = await apiFetch<{ name: string }[]>(page, 'GET', '/api/nutrition/meal-containers')
  expect(list.json.map((c) => c.name)).toEqual(['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5', 'Snack'])
})

test('renaming a container is retroactive and archiving never deletes', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const list = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const first = list.json[0]

  const rename = await apiFetch(page, 'PUT', `/api/nutrition/meal-containers/${first.id}`, { name: 'Breakfast' })
  expect(rename.ok).toBe(true)

  const archive = await apiFetch(page, 'DELETE', `/api/nutrition/meal-containers/${first.id}`)
  expect(archive.ok).toBe(true)

  const after = await apiFetch<{ id: number; name: string; isArchived: boolean }[]>(
    page,
    'GET',
    '/api/nutrition/meal-containers?includeArchived=1'
  )
  const archived = after.json.find((c) => c.id === first.id)
  expect(archived!.name).toBe('Breakfast')
  expect(archived!.isArchived).toBe(true)
})

test('rejects a duplicate container name for the same user', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const res = await apiFetch(page, 'POST', '/api/nutrition/meal-containers', { name: 'Snack' })
  expect(res.status).toBe(409)
})

test('an archived container frees its name for a new or renamed container', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  type Container = { id: number; name: string }
  const containers = (await apiFetch<Container[]>(page, 'GET', '/api/nutrition/meal-containers')).json
  const snack = containers.find((c) => c.name === 'Snack')!
  expect((await apiFetch(page, 'DELETE', `/api/nutrition/meal-containers/${snack.id}`)).ok).toBe(true)
  expect((await apiFetch(page, 'POST', '/api/nutrition/meal-containers', { name: 'Snack' })).status).toBe(200)
  const other = containers.find((c) => c.name === 'Meal 5')!
  expect((await apiFetch(page, 'DELETE', `/api/nutrition/meal-containers/${other.id}`)).ok).toBe(true)
  const meal4 = containers.find((c) => c.name === 'Meal 4')!
  expect((await apiFetch(page, 'PUT', `/api/nutrition/meal-containers/${meal4.id}`, { name: 'Meal 5' })).status).toBe(
    200
  )
  expect((await apiFetch(page, 'POST', '/api/nutrition/meal-containers', { name: 'Snack' })).status).toBe(409)
})
