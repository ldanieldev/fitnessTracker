import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

const NUTELLA_BARCODE = '3017624010701'

test.describe('external food search, barcode lookup and import', () => {
  test.skip(!process.env.NUXT_OFF_USER_AGENT, 'OFF not configured')

  test('imports a barcode hit from OFF, is idempotent, and becomes read-only local catalogue', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    // The dev DB is persistent with no delete path for catalogue rows, so this barcode may already be imported.
    const found = await apiFetch<{ found: string, foodId?: number, external?: { source: string, externalId: string } }>(
      page,
      'GET',
      `/api/nutrition/foods/barcode/${NUTELLA_BARCODE}`
    )
    expect(found.status).toBe(200)
    expect(['off', 'local']).toContain(found.json.found)
    if (found.json.found === 'off') expect(found.json.external?.source).toBe('off')
    else expect(typeof found.json.foodId).toBe('number')

    const imported = await apiFetch<{ id: number, needsNutrition: boolean, owned: boolean }>(
      page,
      'POST',
      '/api/nutrition/foods/import',
      { source: 'off', externalId: NUTELLA_BARCODE }
    )
    expect(imported.status).toBe(200)
    expect(imported.json.needsNutrition).toBe(false)
    expect(imported.json.owned).toBe(false)
    const { id } = imported.json

    const read = await apiFetch<{ servings: Array<{ kind: string, label: string, basisGrams: string | null, nutrients: Record<string, number> }> }>(
      page,
      'GET',
      `/api/nutrition/foods/${id}`
    )
    const weight = read.json.servings.find((s) => s.kind === 'weight' && s.label === 'g')!
    expect(weight).toBeTruthy()
    expect(Object.values(weight.nutrients).some((v) => Math.abs(v - 539) < 5)).toBe(true)

    const reimported = await apiFetch<{ id: number }>(
      page,
      'POST',
      '/api/nutrition/foods/import',
      { source: 'off', externalId: NUTELLA_BARCODE }
    )
    expect(reimported.status).toBe(200)
    expect(reimported.json.id).toBe(id)

    const localAfterImport = await apiFetch<{ found: string, foodId: number }>(
      page,
      'GET',
      `/api/nutrition/foods/barcode/${NUTELLA_BARCODE}`
    )
    expect(localAfterImport.json.found).toBe('local')
    expect(localAfterImport.json.foodId).toBe(id)

    const blockedEdit = await apiFetch(page, 'PUT', `/api/nutrition/foods/${id}`, { name: 'Hacked' })
    expect(blockedEdit.status).toBe(403)
  })

  test('404s a made-up barcode with the barcode in the body', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const res = await apiFetch<{ data?: { barcode: string }, barcode?: string }>(
      page,
      'GET',
      '/api/nutrition/foods/barcode/0000000000000'
    )
    expect(res.status).toBe(404)
    const barcode = res.json.data?.barcode ?? res.json.barcode
    expect(barcode).toBe('0000000000000')
  })

  test('finds nutella via external search with no errors', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const res = await apiFetch<{ results: unknown[], errors: unknown[] }>(
      page,
      'GET',
      '/api/nutrition/foods/search/external?q=nutella&source=off'
    )
    expect(res.status).toBe(200)
    expect(res.json.results.length).toBeGreaterThan(0)
    expect(res.json.errors).toEqual([])
  })

  // source=off avoids the USDA DEMO_KEY rate limit; rerun-safe since re-importing the same row returns its existing id.
  test('searches online, imports a result, and shows it checked in the local tab', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const today = new Date().toISOString().slice(0, 10)
    await goto(`/diary/${today}/add`, { waitUntil: 'hydration' })

    await page.locator('[data-test="online-tab"]').click()
    await page.locator('[data-test="online-query"]').fill('nutella')
    await page.locator('[data-test="online-source"]').click()
    await page.getByRole('option', { name: 'Open Food Facts' }).click()
    await page.locator('[data-test="online-search"]').click()

    const result = page.locator('[data-test="online-result"]').first()
    await expect(result).toBeVisible()

    const [importResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/nutrition/foods/import') && res.request().method() === 'POST'),
      result.locator('[data-test="online-import"]').click()
    ])
    const imported = (await importResponse.json()) as { id: number }

    await expect(page.locator('[data-test="local-tab"]')).toBeVisible()
    // The dev DB accumulates catalogue foods across runs, so the checked row isn't necessarily first — find it by its amount input.
    const checkedRow = page.locator('[data-test="food-hit"]').filter({ has: page.locator('input[role="spinbutton"]') })
    await expect(checkedRow).toBeVisible()

    // The search-result label and the imported/canonical food name can differ (OFF brand/name splitting), so compare against the stored name, not the search label.
    const detail = await apiFetch<{ name: string }>(page, 'GET', `/api/nutrition/foods/${imported.id}`)
    await expect(checkedRow).toContainText(detail.json.name)
  })
})

// Separate describe block: this environment has FatSecret credentials, so this only runs where it doesn't.
test.describe('fatsecret unconfigured', () => {
  test.skip(!!process.env.NUXT_FATSECRET_CLIENT_ID, 'FatSecret configured')

  test('reports an unconfigured fatsecret source as an error, not a 500', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const res = await apiFetch<{ errors: Array<{ kind: string }> }>(
      page,
      'GET',
      '/api/nutrition/foods/search/external?q=x&source=fatsecret'
    )
    expect(res.status).toBe(200)
    expect(res.json.errors[0]?.kind).toBe('unconfigured')
  })
})
