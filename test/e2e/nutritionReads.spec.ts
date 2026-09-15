import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, rebuildSearchIndex, uniquePrefix } from './helpers'

test('search and recent hits carry perDefault; favorites=1 lists favourites only', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()
  const egg = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Egg`, servings: [{ kind: 'named', label: 'egg', quantity: 1, nutrients: { energy: 69, protein: 6, fat: 5 } }]
  })
  const oats = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Oats`, servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380, protein: 13, carbohydrate: 67, fat: 7 } }]
  })
  await apiFetch(page, 'PUT', `/api/nutrition/foods/${egg.json.id}/favorite`)
  await rebuildSearchIndex(page)

  const search = await apiFetch<{ hits: Array<{ id: number, perDefault: { label: string, quantity: number, energy: number } | null }> }>(page, 'GET', `/api/nutrition/foods/search?q=${encodeURIComponent(p)}`)
  const oatsHit = search.json.hits.find((h) => h.id === oats.json.id)!
  expect(oatsHit.perDefault).toEqual({ label: 'g', quantity: 100, energy: 380, protein: 13, carbohydrate: 67, fat: 7 })

  const recent = await apiFetch<Array<{ id: number, perDefault: { energy: number } | null }>>(page, 'GET', '/api/nutrition/foods/recent')
  expect(recent.json.find((r) => r.id === egg.json.id)?.perDefault?.energy).toBe(69)

  const favs = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/foods/recent?favorites=1')
  expect(favs.json.map((r) => r.id)).toEqual([egg.json.id])
})

test('diary/logged returns the dates with a diary row in range', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = (await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-08/entries', [
    { entryType: 'quick_add', containerId: containers[0]!.id, description: 'x', quantity: 1, unitLabel: 'serving', nutrients: { energy: 1 } }
  ])
  await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-09-10/notes', { notes: 'hi' })

  const logged = await apiFetch<{ dates: string[] }>(page, 'GET', '/api/nutrition/diary/logged?from=2026-09-07&to=2026-09-13')
  expect(logged.json.dates).toEqual(['2026-09-08', '2026-09-10'])
  const tooWide = await apiFetch(page, 'GET', '/api/nutrition/diary/logged?from=2026-01-01&to=2026-12-31')
  expect(tooWide.status).toBe(400)
})
