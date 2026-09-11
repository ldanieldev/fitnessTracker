import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'

test('no nutrition screen scrolls sideways at the phone width', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Layout Food With A Deliberately Long Name For Wrapping', servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 100 } }]
  })
  const containers = (await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-07/entries', [
    { entryType: 'food', containerId: containers[0]!.id, foodId: food.json.id, quantity: 100, unitLabel: 'g' }
  ])

  const routes = [
    '/diary/2026-09-07', '/diary/2026-09-07/add', '/diary/2026-09-07/scan', '/diary/2026-09-07/foods/new',
    '/diary/summary?from=2026-09-01&to=2026-09-07', '/nutrition/recipes', '/nutrition/recipes/new',
    '/nutrition/saved-meals', '/nutrition/saved-meals/new', '/nutrition/foods', `/nutrition/foods/${food.json.id}`,
    '/nutrition/foods/new', '/settings/nutrition'
  ]
  for (const route of routes) {
    await goto(route, { waitUntil: 'hydration' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, route).toBeLessThanOrEqual(0)
  }
})

test('the summary shows one card per day on the phone', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/diary/summary?from=2026-09-01&to=2026-09-03', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="summary-card"]')).toHaveCount(3)
  await expect(page.locator('table')).toHaveCount(0)
})
