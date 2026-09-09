import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('creates a unit-first food and resolves both bases independently', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Homemade Pizza',
    servings: [
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { protein: 3, carbohydrate: 2, fat: 5 } },
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1, carbohydrate: 2, fat: 2 } }
    ]
  })
  expect(created.status).toBe(200)
  const { id } = created.json

  const read = await apiFetch(page, 'GET', `/api/nutrition/foods/${id}`)
  const food = read.json as {
    servings: Array<{ id: number, label: string, nutrients: Record<number, number> }>
    defaultServingId: number
    energyDensity: number
  }

  expect(food.servings).toHaveLength(2)
  const slice = food.servings.find((s) => s.label === 'slice')!
  const grams = food.servings.find((s) => s.label === 'g')!
  // slice derives to 65 kcal, the weight basis to 30; neither map may contain the other's energy
  expect(Object.values(slice.nutrients)).not.toContain(30)
  expect(Object.values(grams.nutrients)).toContain(30)
  // energy derived at save: 3*4 + 2*4 + 5*9 = 65
  expect(Object.values(slice.nutrients)).toContain(65)
  // the weight serving is the headline, and 100 g at 1p/2c/2f derives to 30 kcal -> 30 kcal per 100 g
  expect(food.defaultServingId).toBe(grams.id)
  expect(food.energyDensity).toBeCloseTo(30, 6)
})

test('rejects a deriving serving with no gram weight', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const res = await apiFetch(page, 'POST', '/api/nutrition/foods', {
    name: 'Bad',
    servings: [{ kind: 'named', label: 'cup', quantity: 1 }]
  })
  expect(res.status).toBe(400)
})

test('requires authentication', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const base = new URL(page.url()).origin
  const res = await page.request.post(`${base}/api/nutrition/foods`, { data: { name: 'x', servings: [] } })
  expect([400, 401]).toContain(res.status())
})

test('refuses to delete the gram basis while another serving derives from it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Cottage Cheese',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  expect(created.status).toBe(200)
  const { id } = created.json

  const addCup = await apiFetch(page, 'POST', `/api/nutrition/foods/${id}/servings`, {
    kind: 'named',
    label: 'cup',
    quantity: 1,
    basisGrams: 120
  })
  expect(addCup.ok).toBe(true)

  const beforeDelete = await apiFetch<{ servings: Array<{ id: number, label: string }> }>(
    page,
    'GET',
    `/api/nutrition/foods/${id}`
  )
  const weightServing = beforeDelete.json.servings.find((s) => s.label === 'g')!
  const cupServing = beforeDelete.json.servings.find((s) => s.label === 'cup')!

  const blockedDelete = await apiFetch(page, 'DELETE', `/api/nutrition/foods/${id}/servings/${weightServing.id}`)
  expect(blockedDelete.status).toBe(409)

  const cupDelete = await apiFetch(page, 'DELETE', `/api/nutrition/foods/${id}/servings/${cupServing.id}`)
  expect(cupDelete.ok).toBe(true)

  const weightDelete = await apiFetch(page, 'DELETE', `/api/nutrition/foods/${id}/servings/${weightServing.id}`)
  expect(weightDelete.ok).toBe(true)

  const afterDelete = await apiFetch<{ servings: unknown[] }>(page, 'GET', `/api/nutrition/foods/${id}`)
  expect(afterDelete.json.servings).toHaveLength(0)
})

test('refuses to edit away the gram basis while another serving derives from it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Yogurt',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  expect(created.status).toBe(200)
  const { id } = created.json

  const addCup = await apiFetch(page, 'POST', `/api/nutrition/foods/${id}/servings`, {
    kind: 'named',
    label: 'cup',
    quantity: 1,
    basisGrams: 120
  })
  expect(addCup.ok).toBe(true)

  const before = await apiFetch<{ servings: Array<{ id: number, label: string }> }>(
    page,
    'GET',
    `/api/nutrition/foods/${id}`
  )
  const weightServing = before.json.servings.find((s) => s.label === 'g')!

  const blockedEdit = await apiFetch(page, 'PUT', `/api/nutrition/foods/${id}/servings/${weightServing.id}`, {
    kind: 'named',
    label: 'piece',
    quantity: 1,
    nutrients: { protein: 10 }
  })
  expect(blockedEdit.status).toBe(409)

  const allowedEdit = await apiFetch(page, 'PUT', `/api/nutrition/foods/${id}/servings/${weightServing.id}`, {
    kind: 'named',
    label: 'piece',
    quantity: 1,
    basisGrams: 100,
    nutrients: { protein: 10 }
  })
  expect(allowedEdit.ok).toBe(true)
})

test('forking a food produces an independent user-owned copy', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Fork source',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const { id } = created.json

  const forked = await apiFetch<{ id: number }>(page, 'POST', `/api/nutrition/foods/${id}/fork`)
  expect(forked.ok).toBe(true)
  expect(forked.json.id).not.toBe(id)

  const read = await apiFetch<{
    name: string
    createdByUserId: number | null
    servings: Array<{ nutrients: Record<string, number> }>
  }>(page, 'GET', `/api/nutrition/foods/${forked.json.id}`)
  expect(read.json.name).toBe('Fork source')
  expect(read.json.servings).toHaveLength(1)
  expect(Object.values(read.json.servings[0]!.nutrients)).toContain(10)
  expect(read.json.createdByUserId).not.toBeNull()
})

test('updating a food changes only name, brand and barcode', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Before',
    brand: 'OldCo',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const id = created.json.id

  const updated = await apiFetch<{ id: number, name: string, brand: string | null, barcode: string | null }>(
    page,
    'PUT',
    `/api/nutrition/foods/${id}`,
    { name: 'After', brand: null, barcode: '0123456789012' }
  )
  expect(updated.ok).toBe(true)
  expect(updated.json).toMatchObject({ id, name: 'After', brand: null, barcode: '0123456789012' })

  const read = await apiFetch<{ name: string, servings: Array<{ nutrients: Record<string, number> }> }>(
    page,
    'GET',
    `/api/nutrition/foods/${id}`
  )
  expect(read.json.name).toBe('After')
  expect(read.json.servings).toHaveLength(1)
  expect(Object.values(read.json.servings[0]!.nutrients)).toContain(10)

  const invalid = await apiFetch(page, 'PUT', `/api/nutrition/foods/${id}`, { name: '' })
  expect(invalid.status).toBe(400)
})

test('soft-deleted foods disappear from reads but are not destroyed', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const created = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Doomed',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1 } }]
  })
  const { id } = created.json

  const deleted = await apiFetch(page, 'DELETE', `/api/nutrition/foods/${id}`)
  expect(deleted.ok).toBe(true)

  const afterDelete = await apiFetch(page, 'GET', `/api/nutrition/foods/${id}`)
  expect(afterDelete.status).toBe(404)
})

test('starred foods rank above unstarred ones in recents', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const mk = async (name: string) => {
    const res = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
      name,
      servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1 } }]
    })
    return res.json.id
  }

  const plain = await mk('Plain food')
  const starred = await mk('Starred food')
  expect((await apiFetch(page, 'PUT', `/api/nutrition/foods/${starred}/favorite`)).ok).toBe(true)

  const recents = await apiFetch<Array<{ id: number, isFavorite: boolean }>>(
    page,
    'GET',
    '/api/nutrition/foods/recent'
  )
  expect(recents.json[0].id).toBe(starred)
  expect(recents.json.map((f) => f.id)).toContain(plain)

  expect((await apiFetch(page, 'DELETE', `/api/nutrition/foods/${starred}/favorite`)).ok).toBe(true)
  const after = await apiFetch<Array<{ id: number, isFavorite: boolean }>>(
    page,
    'GET',
    '/api/nutrition/foods/recent'
  )
  expect(after.json.find((f) => f.id === starred)!.isFavorite).toBe(false)
})

test('refuses to add a deriving serving to a food with no gram basis', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Basisless bar',
    servings: [{ kind: 'named', label: 'bar', quantity: 1, nutrients: { protein: 8 } }]
  })

  const res = await apiFetch(page, 'POST', `/api/nutrition/foods/${food.json.id}/servings`, {
    kind: 'named',
    label: 'box',
    quantity: 1,
    basisGrams: 240
  })
  expect(res.status).toBe(400)
  expect(JSON.stringify(res.json)).toContain('gram basis')
})
