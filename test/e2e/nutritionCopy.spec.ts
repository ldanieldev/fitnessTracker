import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

test('copying recomputes from the food as it is today', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Oats',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodId = food.json.id

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-01/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 100, unitLabel: 'g' }
  ])

  const loaded = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${foodId}`)
  await apiFetch(page, 'PUT', `/api/nutrition/foods/${foodId}/servings/${loaded.json.servings[0].id}`, {
    kind: 'weight',
    label: 'g',
    quantity: 100,
    nutrients: { protein: 20 }
  })
  await apiFetch(page, 'PUT', `/api/nutrition/foods/${foodId}`, { name: 'Oats (renamed)' })

  const copyRes = await apiFetch(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-04-02',
    targetContainerId: null
  })
  expect(copyRes.ok).toBe(true)

  const source = await apiFetch<{ entries: Array<{ nutrients: Record<string, number>; description: string | null }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-04-01'
  )
  const copy = await apiFetch<{ entries: Array<{ nutrients: Record<string, number>; description: string | null }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-04-02'
  )
  expect(Number(source.json.entries[0].nutrients.protein)).toBeCloseTo(10, 6)
  expect(Number(copy.json.entries[0].nutrients.protein)).toBeCloseTo(20, 6)
  expect(source.json.entries[0].description).toBe('Oats')
  expect(copy.json.entries[0].description).toBe('Oats (renamed)')
})

test('copying a quick-add copies its snapshot verbatim', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-03/entries', [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Restaurant burger',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 800, protein: 40, carbohydrate: 60, fat: 40 }
    }
  ])

  const copyRes = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-04-04',
    targetContainerId: null
  })
  expect(copyRes.json.ids).toHaveLength(1)

  const copy = await apiFetch<{ entries: Array<{ nutrients: Record<string, number>; unitLabel: string }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-04-04'
  )
  expect(Number(copy.json.entries[0].nutrients.protein)).toBeCloseTo(40, 6)
  expect(Number(copy.json.entries[0].nutrients.energy)).toBeCloseTo(800, 6)
  expect(copy.json.entries[0].unitLabel).toBe('serving')
})

test('excluding every item returns 400 and creates no day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-05/entries', [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Snack',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { protein: 5 }
    }
  ])

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-04-06',
    targetContainerId: null,
    overrides: created.json.ids.map((id) => ({ sourceEntryId: id, exclude: true }))
  })
  expect(res.status).toBe(400)

  const day = await apiFetch<{ persisted: boolean }>(page, 'GET', '/api/nutrition/diary/2026-04-06')
  expect(day.json.persisted).toBe(false)

  const invalidDate = await apiFetch(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-02-31',
    targetContainerId: null
  })
  expect(invalidDate.status).toBe(400)
})

test('multi-select copy redirects every item into the target container', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-07/entries', [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'A',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { protein: 5 }
    },
    {
      entryType: 'quick_add',
      containerId: containers.json[1].id,
      description: 'B',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { protein: 8 }
    }
  ])

  await apiFetch(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-04-08',
    targetContainerId: containers.json[2].id
  })

  const copy = await apiFetch<{ entries: Array<{ containerId: number }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-04-08'
  )
  expect(copy.json.entries).toHaveLength(2)
  expect(copy.json.entries.every((e) => e.containerId === containers.json[2].id)).toBe(true)
})

test('a soft-deleted food falls back to the frozen snapshot', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Gone Soon',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodId = food.json.id

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-09/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 100, unitLabel: 'g' }
  ])

  const deleted = await apiFetch(page, 'DELETE', `/api/nutrition/foods/${foodId}`)
  expect(deleted.ok).toBe(true)

  const copyRes = await apiFetch<{ ids: number[]; fellBackToSnapshot: number[] }>(
    page,
    'POST',
    '/api/nutrition/diary/copy',
    { sourceEntryIds: created.json.ids, targetDate: '2026-04-10', targetContainerId: null }
  )
  expect(copyRes.json.fellBackToSnapshot).toEqual(created.json.ids)

  const copy = await apiFetch<{
    entries: Array<{ nutrients: Record<string, number>; gramsResolved: number | null; foodId: number | null }>
  }>(page, 'GET', '/api/nutrition/diary/2026-04-10')
  expect(Number(copy.json.entries[0].nutrients.protein)).toBeCloseTo(10, 6)
  expect(Number(copy.json.entries[0].gramsResolved)).toBe(100)
  expect(copy.json.entries[0].foodId).toBe(foodId)
})

test('copying a recipe entry keeps its recipeId and snapshot', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Oats',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const loadedFood = await apiFetch<{ servings: Array<{ id: number }> }>(
    page,
    'GET',
    `/api/nutrition/foods/${food.json.id}`
  )

  const recipe = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/recipes', {
    name: 'Porridge',
    servings: 4,
    servingName: 'Bowls',
    ingredients: [
      { foodId: food.json.id, foodServingId: loadedFood.json.servings[0].id, quantity: 400, unitLabel: 'g' }
    ]
  })
  const recipeId = recipe.json.id

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-11/entries', [
    { entryType: 'recipe', recipeId, containerId: containers.json[0].id, quantity: 2, unitLabel: 'Bowls' }
  ])

  interface SnapshotItem {
    nutrients: Record<string, number>
  }
  interface DiaryEntry {
    entryType: string
    recipeId: number | null
    nutrients: Record<string, number>
    ingredientSnapshot: SnapshotItem[]
  }
  const sumProtein = (items: SnapshotItem[]) =>
    items.reduce((sum, item) => sum + Number(item.nutrients.protein ?? 0), 0)

  const copyRes = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-04-12',
    targetContainerId: null
  })
  expect(copyRes.json.ids).toHaveLength(1)

  const source = await apiFetch<{ entries: DiaryEntry[] }>(page, 'GET', '/api/nutrition/diary/2026-04-11')
  const copy = await apiFetch<{ entries: DiaryEntry[] }>(page, 'GET', '/api/nutrition/diary/2026-04-12')

  expect(copy.json.entries[0].entryType).toBe('recipe')
  expect(copy.json.entries[0].recipeId).toBe(recipeId)
  expect(Number(copy.json.entries[0].nutrients.protein)).toBeCloseTo(
    Number(source.json.entries[0].nutrients.protein),
    6
  )
  expect(copy.json.entries[0].ingredientSnapshot).toHaveLength(source.json.entries[0].ingredientSnapshot.length)

  const doubledRes = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: '2026-04-13',
    targetContainerId: null,
    overrides: [{ sourceEntryId: created.json.ids[0], quantity: 4 }]
  })
  expect(doubledRes.json.ids).toHaveLength(1)

  const doubled = await apiFetch<{ entries: DiaryEntry[] }>(page, 'GET', '/api/nutrition/diary/2026-04-13')
  expect(Number(doubled.json.entries[0].nutrients.protein)).toBeCloseTo(
    Number(source.json.entries[0].nutrients.protein) * 2,
    6
  )
  expect(sumProtein(doubled.json.entries[0].ingredientSnapshot)).toBeCloseTo(
    Number(doubled.json.entries[0].nutrients.protein),
    6
  )
})

test('copies a day through the dialog with one item excluded and one adjusted', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const foodA = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Copy A',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodB = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Copy B',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 20 } }]
  })

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-08-01/entries', [
    { entryType: 'food', foodId: foodA.json.id, containerId, quantity: 100, unitLabel: 'g' },
    { entryType: 'food', foodId: foodB.json.id, containerId, quantity: 100, unitLabel: 'g' }
  ])

  await goto('/nutrition/diary/2026-08-01', { waitUntil: 'hydration' })
  await page.locator('[data-test="day-menu"]').click()
  await page.getByRole('menuitem', { name: 'Copy day' }).click()

  await page.locator('[data-test="copy-target-date"]').fill('2026-08-02')

  const rows = page.locator('[data-test="copy-source-row"]')
  await expect(rows).toHaveCount(2)
  await rows.nth(0).locator('[data-test="copy-source-checkbox"]').click()
  await rows.nth(1).locator('[data-test="copy-source-quantity"]').fill('200')

  await page.locator('[data-test="copy-confirm"]').click()
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-08-02$/)

  const target = await apiFetch<{
    totals: Record<string, number>
    entries: Array<{ foodId: number | null; quantity: number }>
  }>(page, 'GET', '/api/nutrition/diary/2026-08-02')

  expect(target.json.entries).toHaveLength(1)
  expect(target.json.entries[0]!.foodId).toBe(foodB.json.id)
  expect(Number(target.json.entries[0]!.quantity)).toBe(200)
  expect(Number(target.json.totals.protein)).toBeCloseTo(40, 6)
})

test('copying one entry into a different container on the same date refreshes the day view in place', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number; name: string }>>(page, 'GET', '/api/nutrition/meal-containers')
  const today = todayDate()
  const sourceContainer = containers.json[0]!
  const targetContainer = containers.json[1]!

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Same Day Copy',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })

  await apiFetch(page, 'POST', `/api/nutrition/diary/${today}/entries`, [
    { entryType: 'food', foodId: food.json.id, containerId: sourceContainer.id, quantity: 100, unitLabel: 'g' }
  ])

  await goto(`/nutrition/diary/${today}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="entry-row"]')).toHaveCount(1)

  await page.locator('[data-test="entry-row"]').click()
  await page.locator('[data-test="entry-copy"]').click()
  await page.locator('[data-test="copy-target-container"]').click()
  await page.getByRole('option', { name: targetContainer.name }).click()
  await page.locator('[data-test="copy-confirm"]').click()

  await expect(page).toHaveURL(new RegExp(`/nutrition/diary/${today}$`))
  await expect(page.locator('[data-test="entry-row"]')).toHaveCount(2)

  const target = await apiFetch<{ entries: Array<{ containerId: number }> }>(
    page,
    'GET',
    `/api/nutrition/diary/${today}`
  )
  expect(target.json.entries).toHaveLength(2)
  expect(target.json.entries.some((e) => e.containerId === targetContainer.id)).toBe(true)
  expect(target.json.entries.some((e) => e.containerId === sourceContainer.id)).toBe(true)
})

test('the copy dialog targets today from a past day and keeps a future day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const today = todayDate()
  for (const [day, expected] of [
    [shiftDate(today, -3), today],
    [shiftDate(today, 2), shiftDate(today, 2)]
  ] as const) {
    await apiFetch(page, 'POST', `/api/nutrition/diary/${day}/entries`, [
      {
        entryType: 'quick_add',
        containerId: containers.json[0]!.id,
        description: 'Oats',
        quantity: 1,
        unitLabel: 'serving',
        nutrients: { energy: 300 }
      }
    ])
    await goto(`/nutrition/diary/${day}`, { waitUntil: 'hydration' })
    await page.locator('[data-test="entry-row"]').click()
    await page.locator('[data-test="entry-copy"]').click()
    await expect(page.locator('[data-test="copy-target-date"]')).toHaveValue(expected)
  }
})

test('a copy to another day keeps the time of day, and a quick-add copy refuses a new unit', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-03/entries', [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Oats',
      quantity: 1,
      unitLabel: 'serving',
      loggedAt: '2026-04-03T08:15:00.000Z',
      nutrients: { energy: 300 }
    }
  ])
  const sourceEntryIds = created.json.ids

  const relabelled = await apiFetch(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds,
    targetDate: '2026-04-05',
    overrides: [{ sourceEntryId: sourceEntryIds[0], unitLabel: 'cup' }]
  })
  expect(relabelled.status).toBe(400)

  await apiFetch(page, 'POST', '/api/nutrition/diary/copy', { sourceEntryIds, targetDate: '2026-04-05' })
  const copy = await apiFetch<{ entries: Array<{ loggedAt: string }> }>(page, 'GET', '/api/nutrition/diary/2026-04-05')
  expect(copy.json.entries.map((e) => e.loggedAt)).toEqual(['2026-04-05T08:15:00.000Z'])
})

test('a copy onto today is logged now, not at the source time of day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const today = todayDate()
  const yesterday = shiftDate(today, -1)
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const created = await apiFetch<{ ids: number[] }>(page, 'POST', `/api/nutrition/diary/${yesterday}/entries`, [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Oats',
      quantity: 1,
      unitLabel: 'serving',
      loggedAt: `${yesterday}T00:00:00.000Z`,
      nutrients: { energy: 300 }
    }
  ])

  const before = Date.now()
  await apiFetch(page, 'POST', '/api/nutrition/diary/copy', {
    sourceEntryIds: created.json.ids,
    targetDate: today,
    today
  })
  const after = Date.now()
  const copy = await apiFetch<{ entries: Array<{ loggedAt: string }> }>(page, 'GET', `/api/nutrition/diary/${today}`)
  const loggedAt = Date.parse(copy.json.entries[0]!.loggedAt)
  expect(loggedAt).toBeGreaterThanOrEqual(before - 1000)
  expect(loggedAt).toBeLessThanOrEqual(after + 1000)
})

test('moving an entry to another meal puts it last in that meal', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = (await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  const [a, b] = [containers[0]!.id, containers[1]!.id]
  const quick = (containerId: number, description: string) => ({
    entryType: 'quick_add',
    containerId,
    description,
    quantity: 1,
    unitLabel: 'serving',
    nutrients: { energy: 100 }
  })
  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-04-06/entries', [
    quick(a, 'A1'),
    quick(a, 'A2'),
    quick(b, 'B1'),
    quick(b, 'B2')
  ])
  expect((await apiFetch(page, 'PUT', `/api/nutrition/diary/entries/${created.json.ids[0]}`, { containerId: b })).ok)
    .toBe(true)
  const day = await apiFetch<{ entries: Array<{ containerId: number; description: string }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-04-06'
  )
  expect(day.json.entries.filter((e) => e.containerId === b).map((e) => e.description)).toEqual(['B1', 'B2', 'A1'])
})
