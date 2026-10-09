import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

// Account deletion cascades from users; foods/recipes cascade too but entry/item references to them are NO ACTION,
// so a user who ever logged their own food used to trip the constraint inside the cascade and never get deleted.
test('deleting an account removes every logged own food, recipe, saved meal, and body reading', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  const userId = session.json.user.id
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Own Oats',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 12 } }]
  })
  const foodId = food.json.id
  const servingId = (await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${foodId}`))
    .json.servings[0]!.id

  const recipe = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Oat Bowl',
    servings: 2,
    servingName: 'Bowls',
    ingredients: [{ foodId, foodServingId: servingId, quantity: 200, unitLabel: 'g' }]
  })
  const savedMeal = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/saved-meals', {
    name: 'Oat Morning',
    items: [{ foodId, foodServingId: servingId, quantity: 100, unitLabel: 'g' }]
  })
  expect(recipe.ok && savedMeal.ok).toBe(true)

  const entries = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-01/entries', [
    { entryType: 'food', containerId, foodId, quantity: 100, unitLabel: 'g' },
    { entryType: 'recipe', containerId, recipeId: recipe.json.id, quantity: 1, unitLabel: 'Bowls' }
  ])
  expect(entries.ok).toBe(true)

  const type = await apiFetch<{ id: number }>(page, 'POST', '/api/body/types', {
    name: 'Waist',
    unit: 'in',
    precision: 1,
    direction: 'lower'
  })
  const reading = await apiFetch(page, 'POST', '/api/body/entries', {
    typeId: type.json.id,
    value: 44.2,
    measuredOn: '2026-09-01'
  })
  expect(type.ok && reading.ok).toBe(true)

  const del = await apiFetch(page, 'DELETE', `/api/users/${userId}`)
  expect(del.status).toBe(200)

  await goto('/nutrition/diary/today', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/auth\/login/)
})
