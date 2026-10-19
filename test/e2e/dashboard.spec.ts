import { expect, test } from '@nuxt/test-utils/playwright'
import { format } from 'date-fns'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { MeasurementType } from '../../shared/types/body'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { weekStartOf } from '../../shared/utils/programs'

test('dashboard: every widget renders and a weigh-in ticks the Today row', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })
  for (const id of ['today-strip', 'bodyweight', 'consistency', 'strength', 'nutrition']) {
    await expect(page.locator(`[data-test="dashboard-${id}"]`)).toBeVisible()
  }
  await expect(page.locator('[data-test="today-weighIn"]')).toHaveAttribute('data-state', 'open')

  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  const today = todayDate()
  await apiFetch(page, 'POST', '/api/body/entries', {
    typeId: types.find((t) => t.key === 'bodyweight')!.id,
    value: 180,
    measuredAt: `${today}T08:00:00.000Z`,
    measuredOn: today
  })
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="today-weighIn"]')).toHaveAttribute('data-state', 'done')
  await expect(page.locator('[data-test="bodyweight-latest"]')).toHaveText('180.0')
})

test('dashboard: bodyweight slides from the latest weigh-in to last week\'s average', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  const typeId = types.find((t) => t.key === 'bodyweight')!.id
  const lastWeek = shiftDate(weekStartOf(todayDate(), 1), -7)
  for (const [measuredOn, value] of [
    [lastWeek, 182],
    [shiftDate(lastWeek, 1), 181]
  ] as const) {
    await apiFetch(page, 'POST', '/api/body/entries', {
      typeId,
      value,
      measuredAt: `${measuredOn}T08:00:00.000Z`,
      measuredOn
    })
  }
  await goto('/', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="dashboard-bodyweight"]')
  await expect(card.locator('[data-test="card-aside"]')).toHaveText('Latest')
  await expect(card.locator('[data-test="bodyweight-daily-change"]')).toContainText('↓ 1.0 lbs · since')
  await expect(card.locator('[data-test="bodyweight-slide-daily"]')).toBeInViewport()
  await card.locator('[data-slot="dot"]').nth(1).click()
  await expect(card.locator('[data-test="card-aside"]')).toHaveText('Weekly avg')
  await expect(card.locator('[data-test="bodyweight-slide-average"]')).toBeInViewport()
  await expect(card.locator('[data-test="bodyweight-current"]')).toHaveText('181.5')
  const weekFrom = format(new Date(`${lastWeek}T00:00:00`), 'MMM d')
  await expect(card.locator('[data-test="bodyweight-week"]')).toContainText(weekFrom)
})

test('dashboard: Start opens the log with a session', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })
  await page.locator('[data-test="today-start"]').click()
  await page.waitForURL(/\/workouts\/log/)
  const active = await apiFetch(page, 'GET', '/api/workouts/sessions/active')
  expect(active.status).toBe(200)
})

test('dashboard: hovering a calendar day shows its date', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })
  const day = shiftDate(todayDate(), -2)
  const calendar = page.locator('[data-test="dashboard-nutrition"] [data-test="calendar"]')
  await calendar.locator(`[data-day="${day}"]`).hover()
  await expect(calendar.locator('[data-test="calendar-tip"]')).toHaveText(
    format(new Date(`${day}T00:00:00`), 'EEE, MMM d')
  )
  await page.locator('[data-test="dashboard-nutrition"] h2').hover()
  await expect(calendar.locator('[data-test="calendar-tip"]')).toHaveCount(0)
})
