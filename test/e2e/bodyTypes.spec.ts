import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { MeasurementType, MetricSeries } from '../../shared/types/body'
import { todayDate } from '../../shared/utils/nutritionSummary'

test('custom types: create, reject a duplicate name, edit, soft-delete; built-ins refuse edits', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Bicep')

  const created = await apiFetch<MeasurementType>(page, 'POST', '/api/body/types', { name, unit: 'in', precision: 2, direction: 'higher' })
  expect(created.status).toBe(200)
  expect(created.json.builtIn).toBe(false)
  expect(created.json.direction).toBe('higher')

  const dup = await apiFetch(page, 'POST', '/api/body/types', { name: name.toLowerCase(), unit: 'in', precision: 1, direction: 'neutral' })
  expect(dup.status).toBe(409)

  const list = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  expect(list.map((t) => t.key)).toEqual(['bodyweight', 'body_fat', 'waist', null])

  const patched = await apiFetch<MeasurementType>(page, 'PATCH', `/api/body/types/${created.json.id}`, { precision: 1 })
  expect(patched.json.precision).toBe(1)

  const builtIn = list[0]!
  expect((await apiFetch(page, 'PATCH', `/api/body/types/${builtIn.id}`, { name: 'Nope' })).status).toBe(403)
  expect((await apiFetch(page, 'DELETE', `/api/body/types/${builtIn.id}`)).status).toBe(403)

  const reading = await apiFetch(page, 'POST', '/api/body/entries', { typeId: created.json.id, value: 15.5 })
  expect(reading.ok).toBe(true)
  expect((await apiFetch(page, 'DELETE', `/api/body/types/${created.json.id}`)).json).toEqual({ ok: true })
  expect((await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.some((t) => t.id === created.json.id)).toBe(false)
  expect((await apiFetch(page, 'GET', `/api/body/types/${created.json.id}/entries`)).status).toBe(404)

  // the name is free again after a soft delete
  expect((await apiFetch(page, 'POST', '/api/body/types', { name, unit: 'in', precision: 1, direction: 'neutral' })).status).toBe(200)
})

test('prefs: hiding a built-in removes it from the default list and the overview; includeHidden still returns it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const waist = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'waist')!

  const hidden = await apiFetch<MeasurementType>(page, 'PUT', `/api/body/types/${waist.id}/prefs`, { hidden: true })
  expect(hidden.json.hidden).toBe(true)
  // series must report the caller's prefs too (BM-R16), not the unconditional hidden:false/sortOrder:null default
  const series = await apiFetch<MetricSeries>(page, 'GET', `/api/body/types/${waist.id}/series?to=${todayDate()}`)
  expect(series.json.type.hidden).toBe(true)
  expect((await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.map((t) => t.key)).toEqual(['bodyweight', 'body_fat'])
  expect((await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types?includeHidden=1')).json.map((t) => t.key)).toEqual(['bodyweight', 'body_fat', 'waist'])
  expect((await apiFetch<Array<{ type: { key: string } }>>(page, 'GET', '/api/body/overview')).json.map((m) => m.type.key)).toEqual(['bodyweight', 'body_fat'])

  // omitted `hidden` keeps the stored true; omitted `sortOrder` (next call) keeps the stored 2
  const sortedHidden = await apiFetch<MeasurementType>(page, 'PUT', `/api/body/types/${waist.id}/prefs`, { sortOrder: 2 })
  expect(sortedHidden.json.hidden).toBe(true)
  expect(sortedHidden.json.sortOrder).toBe(2)
  const unhidden = await apiFetch<MeasurementType>(page, 'PUT', `/api/body/types/${waist.id}/prefs`, { hidden: false })
  expect(unhidden.json.hidden).toBe(false)
  expect(unhidden.json.sortOrder).toBe(2)

  const ordered = await apiFetch<MeasurementType>(page, 'PUT', `/api/body/types/${waist.id}/prefs`, { hidden: false, sortOrder: 0 })
  expect(ordered.json.sortOrder).toBe(0)
  expect((await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.map((t) => t.key)).toEqual(['waist', 'bodyweight', 'body_fat'])

  // PATCH must echo the caller's existing prefs row, not report hidden:false/sortOrder:null unconditionally
  const custom = await apiFetch<MeasurementType>(page, 'POST', '/api/body/types', { name: uniquePrefix('Neck'), unit: 'in', precision: 1, direction: 'neutral' })
  await apiFetch(page, 'PUT', `/api/body/types/${custom.json.id}/prefs`, { hidden: true })
  const patchedHidden = await apiFetch<MeasurementType>(page, 'PATCH', `/api/body/types/${custom.json.id}`, { name: uniquePrefix('Neck2') })
  expect(patchedHidden.json.hidden).toBe(true)
})

test('the hub creates a type from the sheet, hides a built-in from its menu, and shows it again', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const waist = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'waist')!
  const name = uniquePrefix('Neck')

  await goto('/body', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="new-type"]')).toHaveClass(/text-inverted/)
  await page.locator('[data-test="new-type"]').click()
  await page.locator('input[data-test="type-name"]').fill(name)
  await page.locator('input[data-test="type-unit"]').fill('in')
  await page.locator('[data-test="type-save"]').click()
  await expect(page.locator('[data-test^="metric-card-"]')).toHaveCount(4)
  await expect(page.getByText(name)).toBeVisible()

  await page.locator(`[data-test="metric-menu-${waist.id}"]`).click()
  await page.getByRole('menuitem', { name: 'Hide' }).click()
  await expect(page.locator('[data-test^="metric-card-"]')).toHaveCount(3)
  await page.locator(`[data-test="show-type-${waist.id}"]`).click()
  await expect(page.locator('[data-test^="metric-card-"]')).toHaveCount(4)
})
