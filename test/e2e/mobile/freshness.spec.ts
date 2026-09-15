import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from '../helpers'

test('a container added in settings appears on the Add screen without a reload', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const name = `${uniquePrefix('C')} Snack`

  // One hard nav establishes the SPA; every step after this is client-side, keeping the Add screen's first containers fetch in the same realm as the settings mutation.
  await goto('/diary/2026-09-08', { waitUntil: 'hydration' })
  await page.locator('[data-test="fab-add"]').click()
  await page.waitForURL('**/diary/2026-09-08/add')
  // The sidebar auto-closes on its own route-settle watcher; wait for that to fire before opening it ourselves, or our own open loses the race.
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Open sidebar' }).click()
  const userMenuButton = page.getByRole('button', { name: user.name })
  await userMenuButton.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await userMenuButton.click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await page.waitForURL('**/settings/security')
  await page.getByRole('link', { name: 'Nutrition' }).click()
  await page.waitForURL('**/settings/nutrition')

  await page.locator('[data-test="add-container-input"]').fill(name)
  await page.locator('[data-test="add-container-submit"]').click()
  // hasText can't read an <input>'s value, and the new row always sorts last.
  await expect(page.locator('[data-test="container-row"] input').last()).toHaveValue(name)

  await page.getByRole('button', { name: 'Open sidebar' }).click()
  await page.getByRole('link', { name: 'Diary' }).click()
  await page.locator('[data-test="fab-add"]').click()
  await page.locator('[data-test="add-container"]').click()
  await expect(page.getByRole('menuitem', { name })).toBeVisible()
})

test('a recipe saved from a meal appears in the Add screen\'s Recipes tab without a reload', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()
  const containers = (await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Oats`, servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380 } }]
  })
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-08/entries', [
    { entryType: 'food', containerId: containers[0]!.id, foodId: food.json.id, quantity: 100, unitLabel: 'g' }
  ])

  // One hard nav establishes the SPA; the FAB/back round trip afterward stays in the same realm as the mutation that must invalidate the recipes fetch asserted empty below.
  await goto('/diary/2026-09-08', { waitUntil: 'hydration' })
  await page.locator('[data-test="fab-add"]').click()
  await page.waitForURL('**/diary/2026-09-08/add')
  await page.locator('[data-test="recipes-tab"]').click()
  await expect(page.locator('[data-test="recipe-choice"]', { hasText: `${p} Bowl` })).toHaveCount(0)

  await page.goBack()
  await page.waitForURL('**/diary/2026-09-08')

  await page.locator(`[data-test="container-${containers[0]!.id}"] [data-test="container-menu"]`).click()
  await page.getByRole('menuitem', { name: 'Save as recipe' }).click()
  await page.locator('[data-test="save-meal-name"]').fill(`${p} Bowl`)
  await page.locator('[data-test="save-meal-submit"]').click()
  await expect(page.locator('[data-slot="title"]', { hasText: 'Saved' })).toBeVisible()

  await page.locator('[data-test="fab-add"]').click()
  await page.locator('[data-test="recipes-tab"]').click()
  await expect(page.locator('[data-test="recipe-choice"]', { hasText: `${p} Bowl` })).toHaveCount(1)
})
