import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, rebuildSearchIndex, registerViaApi, uniquePrefix } from '../helpers'

test('adds a food, a recipe, and a saved meal to one meal in one tap', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()

  const containers = await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/meal-containers')
  const target = containers.json[1]!

  const oats = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Oats`,
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380 } }]
  })
  const egg = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Egg`,
    servings: [{ kind: 'named', label: 'egg', quantity: 1, nutrients: { energy: 69, protein: 6 } }]
  })
  await apiFetch(page, 'PUT', `/api/nutrition/foods/${egg.json.id}/favorite`)
  await apiFetch(page, 'POST', '/api/nutrition/recipes', {
    name: `${p} Chili`, servings: 4, servingName: 'bowl', ingredients: [{ foodId: oats.json.id, quantity: 400, unitLabel: 'g' }]
  })
  await apiFetch(page, 'POST', '/api/nutrition/saved-meals', {
    name: `${p} Breakfast`, items: [{ foodId: egg.json.id, quantity: 2, unitLabel: 'egg' }, { foodId: oats.json.id, quantity: 50, unitLabel: 'g' }]
  })
  await rebuildSearchIndex(page)

  await goto(`/diary/2026-09-01/add?containerId=${target.id}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="add-container"]')).toContainText(target.name)

  await page.locator('[data-test="favorites-tab"]').click()
  await expect(page.locator('[data-test="food-hit"]')).toHaveCount(1)
  await expect(page.locator('[data-test="food-hit"]')).toContainText(`${p} Egg`)
  await page.locator('[data-test="local-tab"]').click()

  await page.locator('[data-test="food-search-input"]').fill(`${p} Egg`)
  const eggHit = page.locator('[data-test="food-hit"]', { hasText: `${p} Egg` })
  await expect(eggHit.locator('[data-test="macro-protein"]')).toHaveText('P 6')
  await eggHit.locator('[data-test="food-hit-checkbox"]').click()
  await eggHit.locator('input[inputmode="decimal"]').fill('3')
  await expect(page.locator('[data-test="tray-count"]')).toContainText('207 kcal')

  await page.locator('[data-test="recipes-tab"]').click()
  const chili = page.locator('[data-test="recipe-choice"]', { hasText: `${p} Chili` })
  await chili.locator('[data-test="recipe-choice-checkbox"]').click()
  const chiliServings = chili.locator('[data-test="recipe-choice-servings"]')
  await chiliServings.fill('2')

  await page.locator('[data-test="meals-tab"]').click()
  await page.locator('[data-test="meal-choice"]', { hasText: `${p} Breakfast` }).locator('[data-test="meal-choice-checkbox"]').click()

  await expect(page.locator('[data-test="tray-count"]')).toContainText('3 items')
  await page.locator('[data-test="add-selected"]').click()
  await expect(page).toHaveURL(/\/diary\/2026-09-01$/)

  const day = await apiFetch<{ entries: Array<{ containerId: number, entryType: string, quantity: number }> }>(page, 'GET', '/api/nutrition/diary/2026-09-01')
  expect(day.json.entries).toHaveLength(4)
  expect(day.json.entries.every((e) => e.containerId === target.id)).toBe(true)
  expect(day.json.entries.find((e) => e.entryType === 'recipe')?.quantity).toBe(2)
})
