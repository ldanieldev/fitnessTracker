import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('reading an untouched date returns an empty day without persisting one', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const day = await apiFetch<{ entries: unknown[], persisted: boolean }>(page, 'GET', '/api/nutrition/diary/2026-01-15')
  expect(day.json.entries).toEqual([])
  expect(day.json.persisted).toBe(false)
})

test('writing a note persists the day and snapshots the default profile targets', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [
      { nutrient: 'energy', amount: 1900, direction: 'max' },
      { nutrient: 'protein', amount: 175, direction: 'min' }
    ]
  })

  const notes = await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-01-16/notes', { notes: 'travel day' })
  expect(notes.ok).toBe(true)

  const day = await apiFetch<{
    persisted: boolean
    notes: string | null
    targets: Array<{ key: string, amount: number, direction: string }>
  }>(page, 'GET', '/api/nutrition/diary/2026-01-16')
  expect(day.json.persisted).toBe(true)
  expect(day.json.notes).toBe('travel day')
  const energy = day.json.targets.find((t) => t.key === 'energy')
  expect(Number(energy!.amount)).toBe(1900)
  expect(energy!.direction).toBe('max')
})

test('editing a goal profile never rewrites a day already snapshotted', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })
  const { id } = created.json

  await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-01-17/notes', { notes: 'x' })

  await apiFetch(page, 'PUT', `/api/nutrition/goal-profiles/${id}`, {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1500, direction: 'max' }]
  })

  const day = await apiFetch<{ targets: Array<{ key: string, amount: number }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-01-17'
  )
  expect(Number(day.json.targets.find((t) => t.key === 'energy')!.amount)).toBe(1900)
})

test('rejects a malformed date', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const res = await apiFetch(page, 'GET', '/api/nutrition/diary/not-a-date')
  expect(res.status).toBe(400)

  const calendarInvalid = await apiFetch(page, 'GET', '/api/nutrition/diary/2026-02-30')
  expect(calendarInvalid.status).toBe(400)
})

test('a deleted default profile is not snapshotted onto new days', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })
  const { id } = created.json

  const deleted = await apiFetch(page, 'DELETE', `/api/nutrition/goal-profiles/${id}`)
  expect(deleted.ok).toBe(true)

  await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-03-01/notes', { notes: 'no default anymore' })

  const day = await apiFetch<{ targets: unknown[], goalProfileId: number | null }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-03-01'
  )
  expect(day.json.targets).toEqual([])
  expect(day.json.goalProfileId).toBeNull()
})

async function seedPizza(page: Page) {
  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Homemade Pizza',
    servings: [
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3, carbohydrate: 2, fat: 5 } },
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1, carbohydrate: 2, fat: 2 } }
    ]
  })
  return created.json.id
}

test('logs by weight and by named serving from independent bases', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const foodId = await seedPizza(page)
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-02-01/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 300, unitLabel: 'g' },
    { entryType: 'food', foodId, containerId: containers.json[1].id, quantity: 2, unitLabel: 'slice' }
  ])
  expect(res.ok).toBe(true)

  const day = await apiFetch<{
    entries: Array<{ unitLabel: string, nutrients: Record<string, number>, gramsResolved: number | null }>
  }>(page, 'GET', '/api/nutrition/diary/2026-02-01')
  const byWeight = day.json.entries.find((e) => e.unitLabel === 'g')!
  const bySlice = day.json.entries.find((e) => e.unitLabel === 'slice')!

  expect(Number(byWeight.nutrients.protein)).toBeCloseTo(3, 6)
  expect(Number(byWeight.gramsResolved)).toBe(300)
  expect(Number(bySlice.nutrients.protein)).toBeCloseTo(6, 6)
  expect(bySlice.gramsResolved).toBeNull()
})

test('per-container subtotals sum to the day total', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const foodId = await seedPizza(page)
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-02-02/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 150, unitLabel: 'g' },
    { entryType: 'food', foodId, containerId: containers.json[1].id, quantity: 1, unitLabel: 'slice' },
    {
      entryType: 'quick_add',
      containerId: containers.json[2].id,
      description: 'Restaurant burger',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 800, protein: 40, carbohydrate: 60, fat: 40 }
    }
  ])

  const day = await apiFetch<{
    containers: Array<{ subtotals: Record<string, number> }>
    totals: Record<string, number>
  }>(page, 'GET', '/api/nutrition/diary/2026-02-02')
  const subtotalSum = day.json.containers.reduce((acc, c) => acc + Number(c.subtotals.protein ?? 0), 0)
  expect(subtotalSum).toBeCloseTo(Number(day.json.totals.protein), 6)
})

test('rejects logging grams for a food with no gram basis', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Slice only',
    servings: [{ kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3 } }]
  })

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-02-03/entries', [
    { entryType: 'food', foodId: created.json.id, containerId: containers.json[0].id, quantity: 100, unitLabel: 'g' }
  ])
  expect(res.status).toBe(400)
  expect(JSON.stringify(res.json)).toContain('NO_WEIGHT_BASIS')
})

test('editing quantity scales the frozen snapshot and ignores later food edits', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Rice',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodId = food.json.id

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-03-01/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 100, unitLabel: 'g' }
  ])
  const entryId = created.json.ids[0]

  // Change the food's macros AFTER logging. History must not move.
  const loaded = await apiFetch<{ servings: Array<{ id: number }> }>(page, 'GET', `/api/nutrition/foods/${foodId}`)
  await apiFetch(page, 'PUT', `/api/nutrition/foods/${foodId}/servings/${loaded.json.servings[0].id}`, {
    kind: 'weight',
    label: 'g',
    quantity: 100,
    nutrients: { protein: 99 }
  })

  // 100 g -> 150 g scales the ORIGINAL 10 g/100 g snapshot to 15, not the new 99 to 148.5
  await apiFetch(page, 'PUT', `/api/nutrition/diary/entries/${entryId}`, { quantity: 150 })
  const day = await apiFetch<{ entries: Array<{ nutrients: Record<string, number> }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-03-01'
  )
  expect(Number(day.json.entries[0].nutrients.protein)).toBeCloseTo(15, 6)
})

test('changing the serving unit recomputes from the food', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const foodId = await seedPizza(page)

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-03-02/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 100, unitLabel: 'g' }
  ])

  await apiFetch(page, 'PUT', `/api/nutrition/diary/entries/${created.json.ids[0]}`, {
    quantity: 2,
    unitLabel: 'slice'
  })
  const day = await apiFetch<{ entries: Array<{ nutrients: Record<string, number> }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-03-02'
  )
  expect(Number(day.json.entries[0].nutrients.protein)).toBeCloseTo(6, 6)
})

test('deleting an entry removes it and its snapshot', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const foodId = await seedPizza(page)

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-03-03/entries', [
    { entryType: 'food', foodId, containerId: containers.json[0].id, quantity: 1, unitLabel: 'slice' }
  ])

  const deleted = await apiFetch(page, 'DELETE', `/api/nutrition/diary/entries/${created.json.ids[0]}`)
  expect(deleted.ok).toBe(true)
  const day = await apiFetch<{ entries: unknown[] }>(page, 'GET', '/api/nutrition/diary/2026-03-03')
  expect(day.json.entries).toEqual([])
})

test('editing a quick-add quantity with the same unit echoed back is not a unit change', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')

  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-03-04/entries', [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Protein shake',
      quantity: 100,
      unitLabel: 'grams',
      nutrients: { protein: 20 }
    }
  ])

  const patched = await apiFetch(page, 'PUT', `/api/nutrition/diary/entries/${created.json.ids[0]}`, {
    quantity: 150,
    unitLabel: 'grams'
  })
  expect(patched.ok).toBe(true)

  const day = await apiFetch<{ entries: Array<{ nutrients: Record<string, number>, unitLabel: string }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-03-04'
  )
  expect(Number(day.json.entries[0].nutrients.protein)).toBeCloseTo(30, 6)
  expect(day.json.entries[0].unitLabel).toBe('g')
})
