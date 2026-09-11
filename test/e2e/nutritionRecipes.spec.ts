import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('computes per-serving nutrition from live ingredients', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const flour = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Flour',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const cheese = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Cheese',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 25 } }]
  })
  const cheeseFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${cheese.json.id}`)

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Homemade Pizza',
    servings: 8,
    servingName: 'Slices',
    ingredients: [
      { foodId: flour.json.id, quantity: 400, unitLabel: 'g' },
      { foodId: cheese.json.id, foodServingId: cheeseFood.json.servings[0].id, quantity: 200, unitLabel: 'g' }
    ]
  })

  const recipe = await apiFetch<{ perServing: Record<string, number>, total: Record<string, number> }>(
    page,
    'GET',
    `/api/nutrition/recipes/${created.json.id}`
  )
  // total protein = 40 + 50 = 90 over 8 servings = 11.25
  expect(Number(recipe.json.total.protein)).toBeCloseTo(90, 6)
  expect(Number(recipe.json.perServing.protein)).toBeCloseTo(11.25, 6)
})

test('recipes are live: editing an ingredient food moves perServing', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const flour = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Flour',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const flourFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${flour.json.id}`)

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Bread',
    servings: 4,
    servingName: 'Slices',
    ingredients: [
      { foodId: flour.json.id, foodServingId: flourFood.json.servings[0].id, quantity: 400, unitLabel: 'g' }
    ]
  })

  const before = await apiFetch<{ perServing: Record<string, number> }>(page, 'GET', `/api/nutrition/recipes/${created.json.id}`)
  expect(Number(before.json.perServing.protein)).toBeCloseTo(10, 6)

  await apiFetch(page, 'PUT', `/api/nutrition/foods/${flour.json.id}/servings/${flourFood.json.servings[0].id}`, {
    kind: 'weight',
    label: 'g',
    quantity: 100,
    nutrients: { protein: 20 }
  })

  const after = await apiFetch<{ perServing: Record<string, number> }>(page, 'GET', `/api/nutrition/recipes/${created.json.id}`)
  expect(Number(after.json.perServing.protein)).toBeCloseTo(20, 6)
})

test('reports a soft-deleted ingredient as broken', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Doomed',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const loadedFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${food.json.id}`)

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Fragile',
    servings: 4,
    servingName: 'Portions',
    ingredients: [
      { foodId: food.json.id, foodServingId: loadedFood.json.servings[0].id, quantity: 200, unitLabel: 'g' }
    ]
  })

  await apiFetch(page, 'DELETE', `/api/nutrition/foods/${food.json.id}`)

  const recipe = await apiFetch<{ brokenIngredients: number[] }>(page, 'GET', `/api/nutrition/recipes/${created.json.id}`)
  expect(recipe.json.brokenIngredients).toContain(food.json.id)
})

test('reports an ingredient as broken when its serving is deleted', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Sliceable',
    servings: [
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } },
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3 } }
    ]
  })
  const loadedFood = await apiFetch<{ servings: Array<{ id: number, label: string }> }>(
    page,
    'GET',
    `/api/nutrition/foods/${food.json.id}`
  )
  const sliceServing = loadedFood.json.servings.find((s) => s.label === 'slice')!

  const recipe = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Sliced Thing',
    servings: 2,
    servingName: 'Portions',
    ingredients: [{ foodId: food.json.id, quantity: 4, unitLabel: 'slice' }]
  })
  const recipeId = recipe.json.id

  const deleted = await apiFetch(page, 'DELETE', `/api/nutrition/foods/${food.json.id}/servings/${sliceServing.id}`)
  expect(deleted.ok).toBe(true)

  const recipeAfter = await apiFetch<{ brokenIngredients: number[] }>(page, 'GET', `/api/nutrition/recipes/${recipeId}`)
  expect(recipeAfter.status).toBe(200)
  expect(recipeAfter.json.brokenIngredients).toContain(food.json.id)

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-05-03/entries', [
    { entryType: 'recipe', recipeId, containerId: containers.json[0].id, quantity: 1, unitLabel: 'Portions' }
  ])
  expect(res.status).toBe(400)
  expect(JSON.stringify(res.json)).toContain('RECIPE_INGREDIENT_MISSING')
})

test('rejects zero servings', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Whatever',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const loadedFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${food.json.id}`)

  const res = await apiFetch(page, 'POST', '/api/nutrition/recipes', {
    name: 'Zero',
    servings: 0,
    servingName: 'Portions',
    ingredients: [
      { foodId: food.json.id, foodServingId: loadedFood.json.servings[0].id, quantity: 200, unitLabel: 'g' }
    ]
  })
  expect(res.status).toBe(400)
})

test('logging a recipe writes one line whose expansion survives later recipe edits', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const mkFood = async (name: string, protein: number) => {
    const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
      name,
      servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein } }]
    })
    return created.json.id
  }

  const flour = await mkFood('Flour', 10)
  const cheese = await mkFood('Cheese', 25)
  const food = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${flour}`)
  const cheeseFood = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${cheese}`)

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Homemade Pizza',
    servings: 8,
    servingName: 'Slices',
    ingredients: [
      { foodId: flour, foodServingId: food.json.servings[0].id, quantity: 400, unitLabel: 'g' },
      { foodId: cheese, foodServingId: cheeseFood.json.servings[0].id, quantity: 200, unitLabel: 'g' }
    ]
  })
  const recipeId = created.json.id

  interface SnapshotItem {
    foodId: number
    quantity: number
    unitLabel: string
    nutrients: Record<string, number>
  }
  interface DiaryEntry {
    unitLabel: string
    nutrients: Record<string, number>
    ingredientSnapshot: SnapshotItem[]
  }
  const sumProtein = (items: SnapshotItem[]) => items.reduce((sum, item) => sum + Number(item.nutrients.protein ?? 0), 0)

  // total protein = 40 + 50 = 90 over 8 servings = 11.25 per slice; 2 slices = 22.5
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-05-01/entries', [
    { entryType: 'recipe', recipeId, containerId: containers.json[0].id, quantity: 2, unitLabel: 'whatever' }
  ])

  let day = await apiFetch<{ entries: DiaryEntry[] }>(page, 'GET', '/api/nutrition/diary/2026-05-01')
  expect(day.json.entries).toHaveLength(1)
  expect(day.json.entries[0].unitLabel).toBe('Slices')
  expect(Number(day.json.entries[0].nutrients.protein)).toBeCloseTo(22.5, 6)
  expect(day.json.entries[0].ingredientSnapshot).toHaveLength(2)
  expect(sumProtein(day.json.entries[0].ingredientSnapshot)).toBeCloseTo(22.5, 6)
  const flourItem = day.json.entries[0].ingredientSnapshot.find((i) => i.foodId === flour)!
  expect(flourItem.quantity).toBeCloseTo(100, 6)

  await apiFetch(page, 'PUT', `/api/nutrition/recipes/${recipeId}`, {
    name: 'Homemade Pizza',
    servings: 8,
    servingName: 'Slices',
    ingredients: [{ foodId: flour, foodServingId: food.json.servings[0].id, quantity: 100, unitLabel: 'g' }]
  })

  day = await apiFetch<{ entries: DiaryEntry[] }>(page, 'GET', '/api/nutrition/diary/2026-05-01')
  expect(Number(day.json.entries[0].nutrients.protein)).toBeCloseTo(22.5, 6)
  expect(day.json.entries[0].ingredientSnapshot).toHaveLength(2)
  expect(sumProtein(day.json.entries[0].ingredientSnapshot)).toBeCloseTo(22.5, 6)
})

test('refuses to log a recipe with a broken ingredient', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Doomed ingredient',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodId = created.json.id
  const food = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${foodId}`)

  const recipe = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Fragile',
    servings: 4,
    servingName: 'Portions',
    ingredients: [{ foodId, foodServingId: food.json.servings[0].id, quantity: 200, unitLabel: 'g' }]
  })
  const recipeId = recipe.json.id

  await apiFetch(page, 'DELETE', `/api/nutrition/foods/${foodId}`)

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-05-02/entries', [
    { entryType: 'recipe', recipeId, containerId: containers.json[0].id, quantity: 1, unitLabel: 'Portions' }
  ])
  expect(res.status).toBe(400)
  expect(JSON.stringify(res.json)).toContain('RECIPE_INGREDIENT_MISSING')
})

test('ingredients resolve through their own base, never through the weight basis', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const pizza = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Dual basis pizza',
    servings: [
      { kind: 'named', label: 'slice', quantity: 1, basisGrams: 130, nutrients: { protein: 3, carbohydrate: 2, fat: 5 } },
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1, carbohydrate: 2, fat: 2 } }
    ]
  })

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Two slices',
    servings: 1,
    servingName: 'Portions',
    ingredients: [{ foodId: pizza.json.id, quantity: 2, unitLabel: 'slice' }]
  })

  const recipe = await apiFetch<{ perServing: Record<string, number> }>(
    page,
    'GET',
    `/api/nutrition/recipes/${created.json.id}`
  )
  // 2 slices through the pinned slice serving = 6 g protein; through the 100 g basis it would be 260/100 * 1 = 2.6
  expect(Number(recipe.json.perServing.protein)).toBeCloseTo(6, 6)
})

test('a gram-unit ingredient resolves by weight even against a named gram basis', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const sliceOnly = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Slice-only loaf',
    servings: [{ kind: 'named', label: 'slice', quantity: 1, basisGrams: 130, nutrients: { protein: 3 } }]
  })

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Weighed loaf',
    servings: 1,
    servingName: 'Portions',
    ingredients: [{ foodId: sliceOnly.json.id, quantity: 260, unitLabel: 'g' }]
  })

  const recipe = await apiFetch<{ perServing: Record<string, number> }>(
    page,
    'GET',
    `/api/nutrition/recipes/${created.json.id}`
  )
  // 260 g over a 130 g basis = 2 x 3 g protein; treating 260 as a serving count would give 780
  expect(Number(recipe.json.perServing.protein)).toBeCloseTo(6, 6)
})

test('a gram-unit ingredient against an ounce weight serving resolves by weight', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const ounced = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Ounce steak',
    servings: [{ kind: 'weight', label: 'oz', quantity: 1, nutrients: { protein: 7 } }]
  })

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Weighed steak',
    servings: 1,
    servingName: 'Portions',
    ingredients: [{ foodId: ounced.json.id, quantity: 400, unitLabel: 'g' }]
  })

  const recipe = await apiFetch<{ perServing: Record<string, number> }>(
    page,
    'GET',
    `/api/nutrition/recipes/${created.json.id}`
  )
  // 400 g / 28.349523125 g per oz x 7 g protein; treating 400 as a serving count would give 2800
  expect(Number(recipe.json.perServing.protein)).toBeCloseTo(98.77, 2)
})

test('recipe reads carry ingredient names, per-line nutrients, and a broken flag', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const oats = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Enriched Oats',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 380, protein: 13 } }]
  })
  const milk = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Enriched Milk',
    servings: [{ kind: 'named', label: 'cup', quantity: 1, nutrients: { energy: 120 } }]
  })
  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Enriched Porridge',
    servings: 2,
    servingName: 'bowl',
    ingredients: [
      { foodId: oats.json.id, quantity: 100, unitLabel: 'g' },
      { foodId: milk.json.id, quantity: 1, unitLabel: 'cup' }
    ]
  })

  const detail = await apiFetch<{ ingredients: Array<{ name: string, nutrients: Record<string, number>, broken: boolean }> }>(
    page, 'GET', `/api/nutrition/recipes/${created.json.id}`
  )
  expect(detail.json.ingredients.map((i) => i.name)).toEqual(['Enriched Oats', 'Enriched Milk'])
  expect(detail.json.ingredients[0]!.nutrients.energy).toBeCloseTo(380, 6)
  expect(detail.json.ingredients.every((i) => !i.broken)).toBe(true)

  const list = await apiFetch<Array<{ id: number, perServing: Record<string, number>, broken: boolean }>>(page, 'GET', '/api/nutrition/recipes')
  const row = list.json.find((r) => r.id === created.json.id)!
  expect(row.perServing.energy).toBeCloseTo(250, 6)
  expect(row.broken).toBe(false)

  await apiFetch(page, 'DELETE', `/api/nutrition/foods/${milk.json.id}`)
  const after = await apiFetch<{ ingredients: Array<{ name: string, broken: boolean }> }>(page, 'GET', `/api/nutrition/recipes/${created.json.id}`)
  expect(after.json.ingredients[1]).toMatchObject({ name: 'Enriched Milk', broken: true })
  const listAfter = await apiFetch<Array<{ id: number, broken: boolean }>>(page, 'GET', '/api/nutrition/recipes')
  expect(listAfter.json.find((r) => r.id === created.json.id)!.broken).toBe(true)
})
