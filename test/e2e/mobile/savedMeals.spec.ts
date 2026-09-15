import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, rebuildSearchIndex, registerViaApi, uniquePrefix } from '../helpers'

test('creates, edits, and deletes a saved meal on the phone', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()

  for (const [name, label, energy] of [[`${p} Egg`, 'egg', 69], [`${p} Toast`, 'slice', 80]] as const) {
    await apiFetch(page, 'POST', '/api/nutrition/foods', {
      name,
      servings: [{ kind: 'named', label, quantity: 1, nutrients: { energy } }]
    })
  }
  await rebuildSearchIndex(page)

  await goto('/nutrition/saved-meals/new', { waitUntil: 'hydration' })
  await page.locator('[data-test="meal-name"]').fill('Phone Breakfast')
  await page.locator('[data-test="add-ingredients"]').click()
  await page.locator('[data-test="food-search-input"]').fill(p)
  for (const name of [`${p} Egg`, `${p} Toast`]) {
    await page.locator('[data-test="food-hit"]', { hasText: name }).locator('[data-test="food-hit-checkbox"]').click()
  }
  const eggAmount = page.locator('[data-test="food-hit"]', { hasText: `${p} Egg` }).locator('input[inputmode="decimal"]')
  await eggAmount.fill('3')
  await page.locator('[data-test="picker-confirm"]').click()
  await expect(page.locator('[data-test="total-energy"]')).toContainText('287')

  await page.locator('[data-test="meal-save"]').click()
  await expect(page).toHaveURL(/\/nutrition\/saved-meals$/)
  const meals = await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/saved-meals')
  const mealId = meals.json.find((m) => m.name === 'Phone Breakfast')!.id

  await page.locator('[data-test="saved-meal-row"]', { hasText: 'Phone Breakfast' }).click()
  await expect(page).toHaveURL(new RegExp(`/nutrition/saved-meals/${mealId}$`))
  await page.locator('[data-test="meal-name"]').fill('Phone Breakfast v2')
  await page.locator('[data-test="meal-save"]').click()
  await expect(page).toHaveURL(/\/nutrition\/saved-meals$/)
  await expect.poll(async () => (await apiFetch<{ name: string }>(page, 'GET', `/api/nutrition/saved-meals/${mealId}`)).json.name)
    .toBe('Phone Breakfast v2')

  await goto('/nutrition/saved-meals', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="saved-meal-row"]', { hasText: 'Phone Breakfast v2' })).toContainText('2 items')

  await page.locator('[data-test="saved-meal-row"]', { hasText: 'Phone Breakfast v2' }).click()
  await page.locator('[data-test="meal-menu"]').click()
  await page.getByRole('menuitem', { name: 'Delete saved meal' }).click()
  await page.locator('[data-test="confirm-delete-meal"]').click()
  await expect(page).toHaveURL(/\/nutrition\/saved-meals$/)
  await expect(page.locator('[data-test="saved-meal-row"]', { hasText: 'Phone Breakfast v2' })).toHaveCount(0)
})
