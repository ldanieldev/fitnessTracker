import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('logs, views, toggles and deletes a diary entry', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })

  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Chicken Breast',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodId = food.json.id

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-01/entries', [
    { entryType: 'food', containerId, foodId, quantity: 150, unitLabel: 'g' }
  ])

  await goto('/diary/2026-07-01', { waitUntil: 'hydration' })

  const entryRow = page.locator('[data-test="entry-row"]')
  await expect(entryRow).toContainText('Chicken Breast')
  await expect(entryRow).toContainText('15')

  const container = page.locator(`[data-test="container-${containerId}"]`)
  await expect(container.locator('[data-test="subtotal-protein"]')).toContainText('15')
  await expect(page.locator('[data-test="total-protein"]')).toContainText('15')

  const energyValue = page.locator('[data-test="energy-value"]')
  const before = await energyValue.textContent()
  await page.getByRole('tab', { name: 'Consumed' }).click()
  await expect(energyValue).not.toHaveText(before ?? '')

  const heading = page.getByRole('heading', { level: 1 })
  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(heading).toHaveText('2026-06-30')
  await expect(page).toHaveURL(/\/diary\/2026-06-30$/)

  await page.getByRole('button', { name: 'Next day' }).click()
  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(heading).toHaveText('2026-07-02')
  await expect(page).toHaveURL(/\/diary\/2026-07-02$/)

  await goto('/diary/2026-07-01', { waitUntil: 'hydration' })
  await entryRow.locator('button').last().click()
  await expect(entryRow).toHaveCount(0)
})

test('creates a slice-only food through the form and logs it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await goto('/diary/2026-07-03/foods/new', { waitUntil: 'hydration' })

  await page.locator('[data-test="food-name"]').fill('UI Pizza')
  await page.locator('[data-test="serving-label"]').fill('slice')
  await page.locator('[data-test="serving-protein"]').fill('3')
  await page.locator('[data-test="serving-carbohydrate"]').fill('2')
  await page.locator('[data-test="serving-fat"]').fill('5')

  await page.locator('[data-test="food-submit"]').click()
  await expect(page).toHaveURL(/\/diary\/2026-07-03\/add$/)

  await page.locator('[data-test="food-search-input"]').fill('UI Pizza')
  const hitRow = page.locator('[data-test="food-hit"]', { hasText: 'UI Pizza' })
  await expect(hitRow).toBeVisible()

  await hitRow.locator('[data-test="food-hit-checkbox"]').click()
  await hitRow.locator('input[role="spinbutton"]').fill('2')

  await page.locator('[data-test="add-selected"]').click()
  await expect(page).toHaveURL(/\/diary\/2026-07-03$/)

  const entryRow2 = page.locator('[data-test="entry-row"]')
  await expect(entryRow2).toContainText('UI Pizza')
  await expect(entryRow2.locator('[data-test="entry-protein"]')).toContainText('6.0')
})

test('selection mode resets when navigating to another day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Selection Reset Food',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-05/entries', [
    { entryType: 'food', foodId: food.json.id, containerId, quantity: 100, unitLabel: 'g' }
  ])

  await goto('/diary/2026-07-05', { waitUntil: 'hydration' })

  const toggle = page.locator('[data-test="toggle-select-mode"]')
  const copySelected = page.locator('[data-test="copy-selected"]')

  await toggle.click()
  await expect(toggle).toHaveText('Done')

  await page.locator('[data-test="entry-select"]').click()
  await expect(copySelected).toBeVisible()
  await expect(copySelected).toBeEnabled()

  await page.getByRole('button', { name: 'Next day' }).click()
  await expect(page).toHaveURL(/\/diary\/2026-07-06$/)

  await expect(toggle).toHaveText('Select')
  await expect(page.locator('[data-test="entry-select"]')).toHaveCount(0)
  await expect(copySelected).toHaveCount(0)

  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page).toHaveURL(/\/diary\/2026-07-05$/)

  await expect(page.locator('[data-test="entry-row"]')).toHaveCount(1)
  await expect(page.locator('[data-test="entry-select"]')).toHaveCount(0)
  await expect(toggle).toHaveText('Select')
})
