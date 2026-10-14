import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { StepWeek } from '../../shared/types/steps'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { weekStartOf } from '../../shared/utils/programs'

async function logDay(page: Page, date: string, energy: number) {
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const res = await apiFetch(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
    {
      entryType: 'quick_add',
      containerId: containers.json[0]!.id,
      description: 'Logged meal',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy }
    }
  ])
  expect(res.ok).toBe(true)
}

interface SummaryDay {
  date: string
  logged: boolean
  incomplete: boolean
  totals: Record<string, number | null>
  rolling: Record<string, number | null>
}

test('incomplete day: flagged via API, kept visible, left out of the rolling average and flagged in the CSV', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await logDay(page, '2026-10-03', 1900)
  await logDay(page, '2026-10-04', 474)
  await logDay(page, '2026-10-05', 1900)

  const bad = await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-10-04/incomplete', { incomplete: 'yes' })
  expect(bad.status).toBe(400)
  const flagged = await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-10-04/incomplete', { incomplete: true })
  expect(flagged.json).toEqual({ date: '2026-10-04', incomplete: true })
  const day = await apiFetch<{ incomplete: boolean }>(page, 'GET', '/api/nutrition/diary/2026-10-04')
  expect(day.json.incomplete).toBe(true)

  const summary = await apiFetch<{ days: SummaryDay[] }>(
    page,
    'GET',
    '/api/nutrition/diary/summary?from=2026-10-03&to=2026-10-05&window=3'
  )
  const byDate = new Map(summary.json.days.map((d) => [d.date, d]))
  expect(byDate.get('2026-10-04')).toMatchObject({ logged: true, incomplete: true, totals: { energy: 474 } })
  expect(byDate.get('2026-10-05')!.rolling.energy).toBe(1900)

  const csv = await page.evaluate(async () =>
    (await fetch('/api/nutrition/diary/export?from=2026-10-03&to=2026-10-05&format=csv')).text()
  )
  const lines = csv.split('\n')
  expect(lines[0]!.startsWith('date,profile,incomplete,')).toBe(true)
  expect(lines.find((l) => l.startsWith('2026-10-04'))).toMatch(/^2026-10-04,[^,]*,true,474,/)
  expect(lines.find((l) => l.startsWith('2026-10-03'))).toMatch(/^2026-10-03,[^,]*,false,1900,/)

  await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-10-04/incomplete', { incomplete: false })
  const after = await apiFetch<{ days: SummaryDay[] }>(
    page,
    'GET',
    '/api/nutrition/diary/summary?from=2026-10-03&to=2026-10-05&window=3'
  )
  expect(after.json.days.find((d) => d.date === '2026-10-05')!.rolling.energy).toBeCloseTo((1900 + 474 + 1900) / 3)
})

test('incomplete day: clearing a flag on a day with no diary row does not create one', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-10-06/incomplete', { incomplete: false })
  const day = await apiFetch<{ persisted: boolean; incomplete: boolean }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-10-06'
  )
  expect(day.json).toMatchObject({ persisted: false, incomplete: false })
})

test('incomplete day: the diary menu marks it, shows the banner, and Undo clears it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await logDay(page, '2026-10-04', 474)
  await goto('/nutrition/diary/2026-10-04', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="day-incomplete"]')).toHaveCount(0)

  await page.locator('[data-test="day-menu"]').click()
  await page.getByRole('menuitem', { name: 'Mark day incomplete' }).click()
  await expect(page.locator('[data-test="day-incomplete"]')).toContainText('left out of averages')

  await page.locator('[data-test="day-menu"]').click()
  await expect(page.getByRole('menuitem', { name: 'Mark day complete' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.locator('[data-test="day-incomplete-undo"]').click()
  await expect(page.locator('[data-test="day-incomplete"]')).toHaveCount(0)
  const after = await apiFetch<{ incomplete: boolean }>(page, 'GET', '/api/nutrition/diary/2026-10-04')
  expect(after.json.incomplete).toBe(false)
})

test('partial step day: counted in the total, left out of the average, round-trips the flag', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  await apiFetch(page, 'PUT', `/api/users/${session.json.user.id}`, { weekStart: 0 })
  const start = shiftDate(weekStartOf(todayDate(), 0), -7)

  const put = await apiFetch(page, 'PUT', `/api/body/steps/days/${start}`, { steps: 334, partial: true })
  expect(put.json).toEqual({ date: start, steps: 334, partial: true })
  await apiFetch(page, 'PUT', `/api/body/steps/days/${shiftDate(start, 1)}`, { steps: 8000 })
  expect((await apiFetch(page, 'PUT', `/api/body/steps/days/${start}`, { steps: 1, partial: 'no' })).status).toBe(400)

  const lookup = await apiFetch(page, 'GET', `/api/body/steps/days/${start}`)
  expect(lookup.json).toEqual({ day: { date: start, steps: 334, partial: true } })

  const list = (await apiFetch<StepWeek[]>(page, 'GET', `/api/body/steps/weeks?count=2&to=${todayDate()}`)).json
  const week = list.find((w) => w.start === start)!
  expect(week).toMatchObject({ total: 8334, logged: 2, partial: 1, average: 8000 })
  expect(week.days[0]).toMatchObject({ steps: 334, partial: true })

  await apiFetch(page, 'PUT', `/api/body/steps/days/${start}`, { steps: 334 })
  const cleared = (await apiFetch<StepWeek[]>(page, 'GET', `/api/body/steps/weeks?count=2&to=${todayDate()}`)).json
  expect(cleared.find((w) => w.start === start)).toMatchObject({ partial: 0, average: 4167 })
})

test('partial step day: the steps sheet saves the switch', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const today = todayDate()
  await goto('/body/steps', { waitUntil: 'hydration' })
  await page.locator(`[data-test="steps-day-${today}"]`).click()
  await page.locator('input[data-test="steps-value"]').fill('334')
  await page.locator('[data-test="steps-partial"]').click()
  await page.locator('[data-test="steps-save"]').click()
  await expect(page.locator(`[data-test="steps-bar-${today}"]`)).toHaveAttribute('data-partial', 'true')
  const lookup = await apiFetch(page, 'GET', `/api/body/steps/days/${today}`)
  expect(lookup.json).toEqual({ day: { date: today, steps: 334, partial: true } })
})
