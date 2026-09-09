import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

async function logDay(page: Page, date: string, energy: number) {
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const res = await apiFetch(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
    {
      entryType: 'quick_add',
      containerId: containers.json[0].id,
      description: 'Logged meal',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy }
    }
  ])
  expect(res.ok).toBe(true)
}

test('rolling summary excludes an unlogged day rather than treating it as zero', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await logDay(page, '2026-03-01', 1800)
  await logDay(page, '2026-03-02', 1850)
  await logDay(page, '2026-03-03', 1900)
  await logDay(page, '2026-03-05', 2000)

  const summary = await apiFetch<{
    days: Array<{ date: string, logged: boolean, totals: Record<string, number | null>, rolling: Record<string, number | null> }>
  }>(page, 'GET', '/api/nutrition/diary/summary?from=2026-03-01&to=2026-03-05&window=3')
  expect(summary.status).toBe(200)

  const skipped = summary.json.days.find((d) => d.date === '2026-03-04')!
  expect(skipped.logged).toBe(false)
  expect(skipped.totals.energy).toBeNull()

  const fifth = summary.json.days.find((d) => d.date === '2026-03-05')!
  expect(fifth.rolling.energy).toBe((1900 + 2000) / 2)
})

test('export returns json with nulled unlogged totals and csv with blank cells', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await logDay(page, '2026-04-01', 1800)
  await logDay(page, '2026-04-02', 1850)
  await logDay(page, '2026-04-03', 1900)
  await logDay(page, '2026-04-05', 2000)

  const json = await apiFetch<{ days: Array<{ date: string, logged: boolean, totals: Record<string, number | null> }> }>(
    page,
    'GET',
    '/api/nutrition/diary/export?from=2026-04-01&to=2026-04-05&format=json'
  )
  expect(json.status).toBe(200)
  expect(json.json.days.length).toBe(5)
  const skipped = json.json.days.find((d) => d.date === '2026-04-04')!
  expect(skipped.totals.energy).toBeNull()

  const csv = await page.evaluate(async () => {
    const res = await fetch('/api/nutrition/diary/export?from=2026-04-01&to=2026-04-05&format=csv')
    return { contentType: res.headers.get('content-type'), text: await res.text() }
  })
  expect(csv.contentType).toContain('text/csv')
  const lines = csv.text.split('\n')
  expect(lines[4].startsWith('2026-04-04,,')).toBe(true)
})

test('summary page renders unlogged days as an em dash and exports csv', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await logDay(page, '2026-05-01', 1800)
  await logDay(page, '2026-05-02', 1850)
  await logDay(page, '2026-05-03', 1900)
  await logDay(page, '2026-05-05', 2000)

  await goto('/diary/summary?from=2026-05-01&to=2026-05-05', { waitUntil: 'hydration' })

  await expect(page.locator('[data-test="summary-energy-total-2026-05-04"]')).toHaveText('—')
  await expect(page.locator('[data-test="summary-energy-total-2026-05-01"]')).toHaveText('1800.0')

  await page.evaluate(() => {
    ;(window as unknown as { __openedUrl: string | null }).__openedUrl = null
    window.open = (url) => {
      ;(window as unknown as { __openedUrl: string | null }).__openedUrl = String(url)
      return null
    }
  })
  await page.locator('[data-test="export-csv"]').click()
  const openedUrl = await page.evaluate(() => (window as unknown as { __openedUrl: string | null }).__openedUrl)
  expect(openedUrl).toContain('/api/nutrition/diary/export')
  expect(openedUrl).toContain('format=csv')
})

test('csv export covers only the tracked nutrients and carries each one\'s target', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const profile = await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })
  expect(profile.ok).toBe(true)

  await logDay(page, '2026-06-01', 1800)

  const csv = await page.evaluate(async () => {
    const res = await fetch('/api/nutrition/diary/export?from=2026-06-01&to=2026-06-01&format=csv')
    return res.text()
  })
  const lines = csv.split('\n')
  expect(lines[0]).toBe(
    'date,profile,energy,energy_target,protein,protein_target,carbohydrate,carbohydrate_target,fat,fat_target,fiber,fiber_target'
  )
  expect(lines[1]).toBe('2026-06-01,Cut,1800,1900,0,,0,,0,,0,')
})
