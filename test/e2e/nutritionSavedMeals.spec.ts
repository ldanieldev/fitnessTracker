import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

async function mkFood(page: import('@playwright/test').Page, name: string, protein: number) {
  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name,
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein } }]
  })
  return created.json.id
}

test('logging a saved meal writes one entry per food, each editable', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const eggs = await mkFood(page, 'Eggs', 12)
  const toast = await mkFood(page, 'Toast', 8)
  const eggsFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${eggs}`)
  const toastFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${toast}`)

  const savedMeal = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/saved-meals', {
    name: 'Usual Breakfast',
    items: [
      { foodId: eggs, foodServingId: eggsFood.json.servings[0].id, quantity: 150, unitLabel: 'g' },
      { foodId: toast, foodServingId: toastFood.json.servings[0].id, quantity: 60, unitLabel: 'g' }
    ]
  })

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-06-01/entries', [
    { entryType: 'food', savedMealId: savedMeal.json.id, containerId: containers.json[0].id, quantity: 1, unitLabel: 'meal' }
  ])

  const day = await apiFetch<{ entries: unknown[], totals: Record<string, number> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-06-01'
  )
  expect(day.json.entries).toHaveLength(2)
  expect(Number(day.json.totals.protein)).toBeCloseTo(12 * 1.5 + 8 * 0.6, 6)
})

test('save-as-recipe skips quick-adds and reports the count', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const foodId = await mkFood(page, 'Rice', 3)

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-06-02/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 150, unitLabel: 'g' },
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Takeaway',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 600, protein: 20 }
    }
  ])

  const res = await apiFetch<{ id: number, skippedQuickAdds: number, flattenedRecipes: number }>(
    page,
    'POST',
    '/api/nutrition/recipes/from-diary',
    { date: '2026-06-02', containerId: containers.json[0].id, name: 'From Monday', servings: 2, servingName: 'Portions' }
  )
  expect(res.json.skippedQuickAdds).toBe(1)

  const recipe = await apiFetch<{ ingredients: Array<{ foodId: number }> }>(
    page,
    'GET',
    `/api/nutrition/recipes/${res.json.id}`
  )
  expect(recipe.json.ingredients).toHaveLength(1)
  expect(recipe.json.ingredients[0].foodId).toBe(foodId)
})

test('from-diary flattens a logged recipe into its ingredients', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const flour = await mkFood(page, 'Flour', 10)
  const cheese = await mkFood(page, 'Cheese', 25)
  const flourFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${flour}`)
  const cheeseFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${cheese}`)

  const recipe = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Homemade Pizza',
    servings: 8,
    servingName: 'Slices',
    ingredients: [
      { foodId: flour, foodServingId: flourFood.json.servings[0].id, quantity: 400, unitLabel: 'g' },
      { foodId: cheese, foodServingId: cheeseFood.json.servings[0].id, quantity: 200, unitLabel: 'g' }
    ]
  })

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-06-03/entries', [
    { entryType: 'recipe', recipeId: recipe.json.id, containerId: containers.json[0].id, quantity: 2, unitLabel: 'Slices' }
  ])

  const res = await apiFetch<{ id: number, skippedQuickAdds: number, flattenedRecipes: number }>(
    page,
    'POST',
    '/api/nutrition/recipes/from-diary',
    { date: '2026-06-03', containerId: containers.json[0].id, name: 'Leftover Pizza', servings: 2, servingName: 'Portions' }
  )
  expect(res.json.flattenedRecipes).toBe(1)

  const newRecipe = await apiFetch<{ ingredients: Array<{ foodId: number, quantity: number }> }>(
    page,
    'GET',
    `/api/nutrition/recipes/${res.json.id}`
  )
  expect(newRecipe.json.ingredients).toHaveLength(2)
  const flourIngredient = newRecipe.json.ingredients.find((i) => i.foodId === flour)!
  const cheeseIngredient = newRecipe.json.ingredients.find((i) => i.foodId === cheese)!
  expect(flourIngredient.quantity).toBeCloseTo(100, 6)
  expect(cheeseIngredient.quantity).toBeCloseTo(50, 6)
})

test('logging a saved meal with a deleted item food fails atomically', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const eggs = await mkFood(page, 'Eggs', 12)
  const toast = await mkFood(page, 'Toast', 8)
  const eggsFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${eggs}`)
  const toastFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${toast}`)

  const savedMeal = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/saved-meals', {
    name: 'Doomed Breakfast',
    items: [
      { foodId: eggs, foodServingId: eggsFood.json.servings[0].id, quantity: 150, unitLabel: 'g' },
      { foodId: toast, foodServingId: toastFood.json.servings[0].id, quantity: 60, unitLabel: 'g' }
    ]
  })

  await apiFetch(page, 'DELETE', `/api/nutrition/foods/${toast}`)

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-06-04/entries', [
    { entryType: 'food', savedMealId: savedMeal.json.id, containerId: containers.json[0].id, quantity: 1, unitLabel: 'meal' }
  ])
  expect(res.status).toBe(400)
  expect(JSON.stringify(res.json)).toContain('SAVED_MEAL_ITEM_MISSING')

  const day = await apiFetch<{ entries: unknown[] }>(page, 'GET', '/api/nutrition/diary/2026-06-04')
  expect(day.json.entries).toHaveLength(0)
})
