import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, seedCatalogFood, uniquePrefix } from '../helpers'

interface FoodJson {
  name: string
  servings: Array<{ id: number, kind: string, label: string, nutrients: Record<string, number> }>
}

test('edits an owned food: header, a serving, a new serving, and a guarded delete', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Sourdough`,
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 260, protein: 9 } }]
  })
  const foodId = created.json.id

  await goto('/nutrition/foods', { waitUntil: 'hydration' })
  await page.locator('[data-test="my-food-row"]', { hasText: `${p} Sourdough` }).click()
  await expect(page).toHaveURL(new RegExp(`/nutrition/foods/${foodId}$`))

  await page.locator('[data-test="food-header-name"]').fill(`${p} Sourdough Loaf`)
  await page.locator('[data-test="food-header-save"]').click()
  await expect(page).toHaveURL(/\/nutrition\/foods$/)
  await expect.poll(async () => (await apiFetch<FoodJson>(page, 'GET', `/api/nutrition/foods/${foodId}`)).json.name).toBe(`${p} Sourdough Loaf`)

  await page.locator('[data-test="my-food-row"]', { hasText: `${p} Sourdough Loaf` }).click()
  await expect(page).toHaveURL(new RegExp(`/nutrition/foods/${foodId}$`))

  const weightCard = page.locator('[data-test="serving-card"]').first()
  await weightCard.locator('[data-test="serving-protein"]').fill('10')
  await weightCard.locator('[data-test="serving-card-save"]').click()
  await expect.poll(async () => {
    const food = (await apiFetch<FoodJson>(page, 'GET', `/api/nutrition/foods/${foodId}`)).json
    return Object.values(food.servings[0]!.nutrients).includes(10)
  }).toBe(true)

  await page.locator('[data-test="add-serving"]').click()
  const newCard = page.locator('[data-test="serving-card"]').last()
  await newCard.locator('[data-test="serving-label"]').fill('slice')
  await newCard.locator('[data-test="serving-basis-grams"]').fill('40')
  await newCard.locator('[data-test="serving-card-save"]').click()
  await expect.poll(async () => (await apiFetch<FoodJson>(page, 'GET', `/api/nutrition/foods/${foodId}`)).json.servings.length).toBe(2)

  await page.locator('[data-test="serving-card"]').first().locator('[data-test="serving-card-delete"]').click()
  await expect(page.locator('[data-test="serving-card"]').first().locator('[data-test="serving-card-error"]')).toBeVisible()
})

test('a catalogue food is read-only until copied', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()

  const catalogue = await seedCatalogFood(page, {
    name: `${p} Catalogue Oats`,
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380 } }]
  })

  await goto(`/nutrition/foods/${catalogue.id}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="catalogue-serving"]')).toHaveCount(1)
  await expect(page.locator('[data-test="food-header-name"]')).toHaveCount(0)

  await page.locator('[data-test="food-fork"]').click()
  await expect(page).not.toHaveURL(new RegExp(`/nutrition/foods/${catalogue.id}$`))
  await expect(page).toHaveURL(/\/nutrition\/foods\/\d+$/)
  await expect(page.locator('[data-test="food-header-name"]')).toHaveValue(new RegExp(`${p} Catalogue Oats`))
})
