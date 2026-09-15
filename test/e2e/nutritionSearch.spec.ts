import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, pollUntil, rebuildSearchIndex, registerViaApi, type ApiResult } from './helpers'

test('reranks search hits by favourite then log frequency, and flags the degraded provider', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const mk = async (name: string) => {
    const res = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
      name,
      servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 1 } }]
    })
    return res.json.id
  }

  const breast = await mk('Chicken breast')
  const thigh = await mk('Chicken thigh')
  const wing = await mk('Chicken wing')

  expect((await apiFetch(page, 'PUT', `/api/nutrition/foods/${wing}/favorite`)).ok).toBe(true)

  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  for (let i = 0; i < 2; i++) {
    const logged = await apiFetch(page, 'POST', '/api/nutrition/diary/2026-04-01/entries', [
      { entryType: 'food', foodId: thigh, containerId, quantity: 100, unitLabel: 'g' }
    ])
    expect(logged.ok).toBe(true)
  }

  await rebuildSearchIndex(page)

  type SearchResult = ApiResult<{
    hits: Array<{ id: number, name: string, brand: string | null, energyDensity: number | null }>
    degraded: boolean
  }>

  const search = await pollUntil<SearchResult>(
    () => apiFetch(page, 'GET', '/api/nutrition/foods/search?q=chick'),
    (res) => res.json.hits.length === 3
  )

  expect(search.json.degraded).toBe(!process.env.NUXT_MEILI_HOST)
  expect(search.json.hits.map((h) => h.id)).toEqual([wing, thigh, breast])
})

test('a percent sign or backslash in the query does not 500', async ({ page, goto }) => {
  test.skip(!!process.env.NUXT_MEILI_HOST, 'escapeLike only runs on the Postgres fallback provider')
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const percentRes = await apiFetch(page, 'GET', `/api/nutrition/foods/search?${new URLSearchParams({ q: '50%' })}`)
  expect(percentRes.status).not.toBe(500)

  const backslashRes = await apiFetch(page, 'GET', `/api/nutrition/foods/search?${new URLSearchParams({ q: 'a\\%' })}`)
  expect(backslashRes.status).not.toBe(500)
})

test('a hit for a food with a weight serving carries its energy density', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await apiFetch(page, 'POST', '/api/nutrition/foods', {
    name: 'Densimeter oats',
    servings: [{ kind: 'weight', label: 'g', quantity: 50, nutrients: { energy: 190 } }]
  })
  await apiFetch(page, 'POST', '/api/nutrition/foods', {
    name: 'Densimeter wrap',
    servings: [{ kind: 'named', label: 'wrap', quantity: 1, nutrients: { energy: 120 } }]
  })

  await rebuildSearchIndex(page)

  type DensimeterResult = ApiResult<{ hits: Array<{ name: string, energyDensity: number | null }> }>

  const search = await pollUntil<DensimeterResult>(
    () => apiFetch(page, 'GET', '/api/nutrition/foods/search?q=Densimeter'),
    (res) => res.json.hits.length === 2
  )

  const oats = search.json.hits.find((h) => h.name === 'Densimeter oats')!
  const wrap = search.json.hits.find((h) => h.name === 'Densimeter wrap')!
  expect(typeof oats.energyDensity).toBe('number')
  expect(oats.energyDensity).toBeCloseTo(380, 6)
  expect(wrap.energyDensity).toBeNull()
})
