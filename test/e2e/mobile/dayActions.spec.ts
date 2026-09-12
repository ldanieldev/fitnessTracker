import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'

async function setup(page: Parameters<typeof registerViaApi>[0]) {
  await registerViaApi(page, makeUser())
  const containers = (await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Action Oats', servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380 } }]
  })
  return { containers, foodId: food.json.id }
}

test('writes and clears day notes', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await setup(page)
  await goto('/diary/2026-09-04', { waitUntil: 'hydration' })

  await page.locator('[data-test="day-menu"]').click()
  await page.getByRole('menuitem', { name: 'Day notes' }).click()
  await page.locator('[data-test="day-notes-input"]').fill('Refeed day')
  await page.locator('[data-test="day-notes-save"]').click()
  await expect(page.locator('[data-test="day-notes-card"]')).toContainText('Refeed day')
  expect((await apiFetch<{ notes: string | null }>(page, 'GET', '/api/nutrition/diary/2026-09-04')).json.notes).toBe('Refeed day')

  await page.locator('[data-test="day-notes-card"]').click()
  await page.locator('[data-test="day-notes-input"]').fill('   ')
  await page.locator('[data-test="day-notes-save"]').click()
  await expect(page.locator('[data-test="day-notes-card"]')).toHaveCount(0)
  expect((await apiFetch<{ notes: string | null }>(page, 'GET', '/api/nutrition/diary/2026-09-04')).json.notes).toBeNull()
})

test('applies another goal profile to one day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await setup(page)
  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Action Cut', inputMode: 'grams', isDefault: true, targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })
  const refeed = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Action Refeed', inputMode: 'grams', isDefault: false, targets: [{ nutrient: 'energy', amount: 2600, direction: 'max' }]
  })

  await goto('/diary/2026-09-05', { waitUntil: 'hydration' })
  await page.locator('[data-test="day-menu"]').click()
  await page.getByRole('menuitem', { name: 'Apply goal profile' }).click()
  await page.locator(`[data-test="goal-option-${refeed.json.id}"]`).click()
  await page.locator('[data-test="goal-apply"]').click()

  await expect(page.getByText('Action Refeed')).toBeVisible()
  await expect(page.locator('[data-test="energy-value"]')).toContainText('2600')
  expect((await apiFetch<{ goalProfileId: number }>(page, 'GET', '/api/nutrition/diary/2026-09-05')).json.goalProfileId).toBe(refeed.json.id)
})

test('saves a meal as a recipe (skipping a quick-add) and as a saved meal', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const { containers, foodId } = await setup(page)
  const meal = containers[0]!
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-06/entries', [
    { entryType: 'food', containerId: meal.id, foodId, quantity: 80, unitLabel: 'g' },
    { entryType: 'quick_add', containerId: meal.id, description: 'Coffee', quantity: 1, unitLabel: 'serving', nutrients: { energy: 5 } }
  ])

  await goto('/diary/2026-09-06', { waitUntil: 'hydration' })
  await page.locator(`[data-test="container-${meal.id}"] [data-test="container-menu"]`).click()
  await page.getByRole('menuitem', { name: 'Save as recipe' }).click()
  await page.locator('[data-test="save-meal-name"]').fill('Action Bowl')
  const servingsInput = page.locator('[data-test="save-meal-servings"]')
  await servingsInput.fill('2')
  await page.locator('[data-test="save-meal-serving-name"]').fill('bowl')
  await page.locator('[data-test="save-meal-submit"]').click()
  // Scoped to the toast title, not the aria-live region that mirrors the same text.
  await expect(page.locator('[data-slot="title"]', { hasText: '1 quick-add skipped' })).toBeVisible()
  const recipes = (await apiFetch<Array<{ name: string, servingName: string }>>(page, 'GET', '/api/nutrition/recipes')).json
  expect(recipes.find((r) => r.name === 'Action Bowl')).toMatchObject({ servingName: 'bowl' })

  await page.locator(`[data-test="container-${meal.id}"] [data-test="container-menu"]`).click()
  await page.getByRole('menuitem', { name: 'Save as saved meal' }).click()
  await expect(page.locator('[data-test="save-meal-servings"]')).toHaveCount(0)
  await page.locator('[data-test="save-meal-name"]').fill('Action Breakfast')
  await page.locator('[data-test="save-meal-submit"]').click()
  await expect.poll(async () => (await apiFetch<Array<{ name: string, itemCount: number }>>(page, 'GET', '/api/nutrition/saved-meals')).json
    .find((m) => m.name === 'Action Breakfast')?.itemCount).toBe(1)
})
