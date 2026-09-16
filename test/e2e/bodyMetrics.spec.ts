import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { MeasurementEntry, MeasurementType } from '../../shared/types/body'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

test('a new user sees the three built-in types, none hidden', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const types = await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')
  expect(types.status).toBe(200)
  expect(types.json.map((t) => t.key)).toEqual(['bodyweight', 'body_fat', 'waist'])
  expect(types.json.every((t) => t.builtIn && !t.hidden)).toBe(true)
  expect(types.json[0]!.unit).toBe('lbs')
  expect(types.json[1]!.precision).toBe(2)
})

test('readings round-trip: create with defaults, list newest first, patch, delete', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  const weight = types.find((t) => t.key === 'bodyweight')!

  const a = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId: weight.id, value: 202, measuredAt: '2026-03-03T09:51:00.000Z', measuredOn: '2026-03-03'
  })
  expect(a.status).toBe(200)
  expect(a.json.value).toBe(202)
  expect(a.json.measuredOn).toBe('2026-03-03')

  const b = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId: weight.id, value: 198.8, measuredAt: '2026-03-11T08:25:00.000Z', measuredOn: '2026-03-11'
  })
  expect(b.ok).toBe(true)

  const defaulted = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 197 })
  expect(defaulted.ok).toBe(true)
  expect(defaulted.json.measuredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)

  const list = await apiFetch<MeasurementEntry[]>(page, 'GET', `/api/body/types/${weight.id}/entries?from=2026-03-01&to=2026-03-31`)
  expect(list.json.map((e) => e.value)).toEqual([198.8, 202])

  const patched = await apiFetch<MeasurementEntry>(page, 'PATCH', `/api/body/entries/${b.json.id}`, { value: 199 })
  expect(patched.json.value).toBe(199)

  const gone = await apiFetch(page, 'DELETE', `/api/body/entries/${a.json.id}`)
  expect(gone.json).toEqual({ ok: true })
  const after = await apiFetch<MeasurementEntry[]>(page, 'GET', `/api/body/types/${weight.id}/entries?from=2026-03-01&to=2026-03-31`)
  expect(after.json.map((e) => e.id)).toEqual([b.json.id])
})

test('validation and ownership: bad body is 400, unknown type is 404, another user\'s entry is 404', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json[0]!

  expect((await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 1, measuredOn: '2026-02-30' })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/body/entries', { typeId: 999999, value: 1 })).status).toBe(404)

  const mine = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 180 })

  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(page.url())
  await registerViaApi(otherPage, makeUser())
  expect((await apiFetch(otherPage, 'PATCH', `/api/body/entries/${mine.json.id}`, { value: 1 })).status).toBe(404)
  expect((await apiFetch(otherPage, 'DELETE', `/api/body/entries/${mine.json.id}`)).status).toBe(404)
  await other.close()
})

test('series reduces to the latest reading per day, echoes the range, and overview carries latest/previous/sparkline', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json[0]!

  for (const [at, value] of [
    ['2026-05-01T07:00:00.000Z', 200], ['2026-05-01T07:00:00.000Z', 201.5], // same measuredAt — id tiebreak picks the later insert
    ['2026-05-03T07:00:00.000Z', 199], ['2026-05-06T07:00:00.000Z', 198]
  ] as const) {
    const res = await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value, measuredAt: at, measuredOn: at.slice(0, 10) })
    expect(res.ok).toBe(true)
  }

  const series = await apiFetch<{ granularity: string, from: string, to: string, points: Array<{ date: string, value: number }> }>(
    page, 'GET', `/api/body/types/${weight.id}/series?from=2026-05-01&to=2026-05-07`
  )
  expect(series.status).toBe(200)
  expect(series.json.granularity).toBe('day')
  expect(series.json.from).toBe('2026-05-01')
  expect(series.json.points).toEqual([
    { date: '2026-05-01', value: 201.5 }, { date: '2026-05-03', value: 199 }, { date: '2026-05-06', value: 198 }
  ])

  const all = await apiFetch<{ from: string, granularity: string }>(page, 'GET', `/api/body/types/${weight.id}/series?to=2026-05-07`)
  expect(all.json.from).toBe('2026-05-01')

  const wide = await apiFetch<{ granularity: string }>(page, 'GET', `/api/body/types/${weight.id}/series?from=2024-01-01&to=2026-05-07`)
  expect(wide.json.granularity).toBe('week')

  const overview = await apiFetch<Array<{ type: { key: string }, latest: { value: number } | null, previous: { value: number } | null, sparkline: unknown[] }>>(
    page, 'GET', '/api/body/overview'
  )
  const row = overview.json.find((m) => m.type.key === 'bodyweight')!
  expect(row.latest?.value).toBe(198)
  expect(row.previous?.value).toBe(199)
  expect(overview.json.find((m) => m.type.key === 'waist')!.latest).toBeNull()
})

test('the hub lists built-ins, logs a reading from a card, and shows it with a delta on the next log', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!

  await goto('/body', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test^="metric-card-"]')).toHaveCount(3)
  await expect(page.locator(`[data-test="metric-latest-${weight.id}"]`)).toHaveText('—')

  await page.locator(`[data-test="metric-log-${weight.id}"]`).click()
  await page.locator('input[data-test="entry-value"]').fill('198.8')
  await page.locator('[data-test="entry-save"]').click()
  await expect(page.locator(`[data-test="metric-latest-${weight.id}"]`)).toHaveText('198.8')
  await expect(page.locator(`[data-test="metric-delta-${weight.id}"]`)).toHaveCount(0)

  await page.locator(`[data-test="metric-log-${weight.id}"]`).click()
  await page.locator('input[data-test="entry-value"]').fill('197')
  await page.locator('[data-test="entry-save"]').click()
  await expect(page.locator(`[data-test="metric-latest-${weight.id}"]`)).toHaveText('197.0')
  await expect(page.locator(`[data-test="metric-delta-${weight.id}"]`)).toHaveText('-1.8')
})

test('the detail page charts the range, lists readings newest first, edits and deletes through the sheet, and switches ranges', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!
  const today = todayDate()
  const ids: number[] = []
  for (const [back, value] of [[20, 200], [10, 199], [0, 198]] as const) {
    const day = shiftDate(today, -back)
    const res = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', { typeId: weight.id, value, measuredAt: `${day}T08:00:00.000Z`, measuredOn: day })
    ids.push(res.json.id)
  }

  await goto(`/body/${weight.id}`, { waitUntil: 'hydration' })
  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: '3m' }).click()
  await expect(page.locator('[data-test="raw-path"]')).toBeVisible()
  await expect(page.locator('[data-test="trend-path"]')).toBeVisible()
  const rows = page.locator('[data-test^="entry-row-"]')
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText('198.0')

  await page.locator(`[data-test="entry-row-${ids[2]}"]`).click()
  await page.locator('input[data-test="entry-value"]').fill('197.5')
  await page.locator('[data-test="entry-save"]').click()
  await expect(rows.first()).toContainText('197.5')

  await page.locator(`[data-test="entry-row-${ids[0]}"]`).click()
  await page.locator('[data-test="entry-delete"]').click()
  await page.locator('[data-test="entry-delete-confirm"]').click()
  await expect(rows).toHaveCount(2)

  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: 'All' }).click()
  await expect(page.locator('[data-test="raw-path"]')).toBeVisible()
  await expect(rows).toHaveCount(2)

  await goto('/body', { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="metric-card-${weight.id}"] [data-test="sparkline"]`)).toBeVisible()
})

test('an unknown type id is a 404 page', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const res = await page.goto(new URL('/body/999999', page.url()).toString())
  expect(res?.status()).toBe(404)
})

test('MTD lists only this month, the progress page charts every visible type, and its range carries into a detail page', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!
  const today = todayDate()
  const lastMonth = shiftDate(`${today.slice(0, 7)}-01`, -1)
  for (const [day, value] of [[lastMonth, 205], [today, 198]] as const) {
    const res = await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value, measuredAt: `${day}T08:00:00.000Z`, measuredOn: day })
    expect(res.ok).toBe(true)
  }

  await goto(`/body/${weight.id}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="range-tabs"] [role="tab"][aria-selected="true"]')).toHaveText('MTD')
  const rows = page.locator('[data-test^="entry-row-"]')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('198.0')

  await goto('/body/progress', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test^="progress-card-"]')).toHaveCount(3)
  const card = page.locator(`[data-test="progress-card-${weight.id}"]`)
  await expect(card).toContainText('198.0')
  await expect(card.locator('[data-test="raw-path"]')).toHaveCount(1)

  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: '1y' }).click()
  await page.locator(`[data-test="progress-link-${weight.id}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/body/${weight.id}$`))
  await expect(page.locator('[data-test="range-tabs"] [role="tab"][aria-selected="true"]')).toHaveText('1y')
  await expect(rows).toHaveCount(2)
})
