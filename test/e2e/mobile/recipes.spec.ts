import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, rebuildSearchIndex, registerViaApi, uniquePrefix } from '../helpers'

test('creates, edits, and repairs a recipe on the phone', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()

  await apiFetch(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Oats`,
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380, protein: 13 } }]
  })
  const milk = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Milk`,
    servings: [{ kind: 'named', label: 'cup', quantity: 1, nutrients: { energy: 120, protein: 8 } }]
  })
  await rebuildSearchIndex(page)

  await goto('/nutrition/recipes/new', { waitUntil: 'hydration' })
  await page.locator('[data-test="recipe-name"]').fill(`${p} Porridge`)
  await page.locator('[data-test="recipe-servings"]').fill('2')
  await page.locator('[data-test="recipe-serving-name"]').fill('bowl')

  await page.locator('[data-test="add-ingredients"]').click()
  await page.locator('[data-test="food-search-input"]').fill(p)
  for (const name of [`${p} Oats`, `${p} Milk`]) {
    await page.locator('[data-test="food-hit"]', { hasText: name }).locator('[data-test="food-hit-checkbox"]').click()
  }
  const oatsHit = page.locator('[data-test="food-hit"]', { hasText: `${p} Oats` })
  const oatsAmount = oatsHit.locator('input[inputmode="decimal"]')
  await oatsAmount.fill('100')
  await page.locator('[data-test="picker-confirm"]').click()

  await expect(page.locator('[data-test="ingredient-row"]')).toHaveCount(2)
  await expect(page.locator('[data-test="total-energy"]')).toContainText('500')
  await expect(page.locator('[data-test="per-serving-energy"]')).toContainText('250')

  await page.locator('[data-test="recipe-save"]').click()
  await expect(page).toHaveURL(/\/nutrition\/recipes$/)
  const recipes = await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/recipes')
  const recipeId = recipes.json.find((r) => r.name === `${p} Porridge`)!.id

  await page.locator('[data-test="recipe-row"]', { hasText: `${p} Porridge` }).click()
  await expect(page).toHaveURL(new RegExp(`/nutrition/recipes/${recipeId}$`))

  await page.locator('[data-test="ingredient-row"]', { hasText: `${p} Milk` }).click()
  const milkAmount = page.getByRole('dialog').locator('input[inputmode="decimal"]')
  await milkAmount.fill('2')
  await page.locator('[data-test="ingredient-done"]').click()
  await expect(page.locator('[data-test="total-energy"]')).toContainText('620')
  await expect(page.locator('[data-test="donut-protein"]')).toContainText('29')
  await page.locator('[data-test="recipe-save"]').click()
  await expect(page).toHaveURL(/\/nutrition\/recipes$/)
  await expect.poll(async () => {
    const r = await apiFetch<{ ingredients: Array<{ quantity: number }> }>(page, 'GET', `/api/nutrition/recipes/${recipeId}`)
    return r.json.ingredients.map((i) => i.quantity)
  }).toEqual([100, 2])

  await apiFetch(page, 'DELETE', `/api/nutrition/foods/${milk.json.id}`)
  await goto(`/nutrition/recipes/${recipeId}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="ingredient-broken"]')).toHaveCount(1)
  await expect(page.locator('[data-test="recipe-save"]')).toBeDisabled()
  await page.locator('[data-test="ingredient-row"]', { hasText: `${p} Milk` }).click()
  await page.locator('[data-test="ingredient-remove"]').click()
  await expect(page.locator('[data-test="recipe-save"]')).toBeEnabled()
  await page.locator('[data-test="recipe-save"]').click()
  await expect(page).toHaveURL(/\/nutrition\/recipes$/)
  await expect(page.locator('[data-test="recipe-row"]', { hasText: `${p} Porridge` })).toContainText('190')
})
