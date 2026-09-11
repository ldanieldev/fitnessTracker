import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, seedCatalogFood } from './helpers'

interface ListedFood {
  id: number
  name: string
  brand: string | null
  defaultServing: { label: string, quantity: number } | null
  energy: number | null
}

test('lists only my own live foods with default-serving energy, filtered by q', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bread = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'List Sourdough',
    brand: 'Bakery',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 260 } }]
  })
  const egg = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'List Egg',
    servings: [{ kind: 'named', label: 'egg', quantity: 1, nutrients: { energy: 69 } }]
  })
  const gone = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'List Deleted',
    servings: [{ kind: 'named', label: 'bar', quantity: 1, nutrients: { energy: 200 } }]
  })
  await apiFetch(page, 'DELETE', `/api/nutrition/foods/${gone.json.id}`)
  await seedCatalogFood(page, { name: 'List Catalogue Oats', servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380 } }] })

  const all = await apiFetch<ListedFood[]>(page, 'GET', '/api/nutrition/foods')
  expect(all.status).toBe(200)
  expect(all.json.map((f) => f.name)).toEqual(['List Egg', 'List Sourdough'])
  expect(all.json[1]).toEqual({
    id: bread.json.id,
    name: 'List Sourdough',
    brand: 'Bakery',
    defaultServing: { label: 'g', quantity: 100 },
    energy: 260
  })
  expect(all.json[0]).toMatchObject({ id: egg.json.id, defaultServing: { label: 'egg', quantity: 1 }, energy: 69 })

  const filtered = await apiFetch<ListedFood[]>(page, 'GET', '/api/nutrition/foods?q=bakery')
  expect(filtered.json.map((f) => f.id)).toEqual([bread.json.id])

  const wildcard = await apiFetch<ListedFood[]>(page, 'GET', '/api/nutrition/foods?q=%25')
  expect(wildcard.json).toEqual([])

  const limited = await apiFetch<ListedFood[]>(page, 'GET', '/api/nutrition/foods?limit=1')
  expect(limited.json).toHaveLength(1)

  const tooMany = await apiFetch(page, 'GET', '/api/nutrition/foods?limit=500')
  expect(tooMany.status).toBe(400)
})
