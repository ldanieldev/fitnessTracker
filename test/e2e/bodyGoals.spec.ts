import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { GoalOverview, MeasurementGoal, MeasurementType, MetricSeries } from '../../shared/types/body'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

test('a goal needs a reading, snapshots the start, upserts, appears on series/overview/goals, and clears', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!

  expect((await apiFetch(page, 'PUT', `/api/body/types/${weight.id}/goal`, { targetValue: 185 })).status).toBe(400)

  await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 200, measuredAt: '2026-09-01T08:00:00.000Z', measuredOn: '2026-09-01' })
  const set = await apiFetch<MeasurementGoal>(page, 'PUT', `/api/body/types/${weight.id}/goal`, { targetValue: 185, targetDate: '2026-12-16' })
  expect(set.status).toBe(200)
  expect(set.json).toEqual({ typeId: weight.id, targetValue: 185, targetDate: '2026-12-16', startValue: 200, startDate: '2026-09-01' })

  await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 197, measuredAt: '2026-09-10T08:00:00.000Z', measuredOn: '2026-09-10' })
  const again = await apiFetch<MeasurementGoal>(page, 'PUT', `/api/body/types/${weight.id}/goal`, { targetValue: 180 })
  expect(again.json.targetDate).toBeNull()
  expect(again.json.startValue).toBe(197)

  const series = await apiFetch<MetricSeries>(page, 'GET', `/api/body/types/${weight.id}/series?from=2026-09-01&to=2026-09-30`)
  expect(series.json.goal?.targetValue).toBe(180)
  const overview = await apiFetch<Array<{ type: { key: string }, goal: MeasurementGoal | null }>>(page, 'GET', '/api/body/overview')
  expect(overview.json.find((m) => m.type.key === 'bodyweight')!.goal?.targetValue).toBe(180)
  const goals = await apiFetch<GoalOverview[]>(page, 'GET', '/api/body/goals')
  expect(goals.json).toHaveLength(1)
  expect(goals.json[0]!.latest?.value).toBe(197)

  expect((await apiFetch(page, 'DELETE', `/api/body/types/${weight.id}/goal`)).json).toEqual({ ok: true })
  expect((await apiFetch<GoalOverview[]>(page, 'GET', '/api/body/goals')).json).toHaveLength(0)
  expect((await apiFetch<MetricSeries>(page, 'GET', `/api/body/types/${weight.id}/series?to=2026-09-30`)).json.goal).toBeNull()
})

test('the detail tiles set a goal, the chart draws its line, the goals page lists it, and clearing removes it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!
  const today = todayDate()
  for (const [back, value] of [[45, 210], [14, 200], [7, 199], [0, 198]] as const) {
    const day = shiftDate(today, -back)
    await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value, measuredAt: `${day}T08:00:00.000Z`, measuredOn: day })
  }

  await goto(`/body/${weight.id}`, { waitUntil: 'hydration' })
  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: '3m' }).click()
  await expect(page.locator('[data-test="tile-goal"]')).toContainText('Set a goal')
  await expect(page.locator('[data-test="goal-line"]')).toHaveCount(0)

  await page.locator('[data-test="tile-goal"]').click()
  await page.locator('input[data-test="goal-target"]').fill('185')
  await page.locator('input[data-test="goal-date"]').fill(shiftDate(today, 90))
  await page.locator('[data-test="goal-save"]').click()
  await expect(page.locator('[data-test="tile-goal"]')).toContainText('185.0')
  await expect(page.locator('[data-test="tile-goal"]')).toContainText('13.0 lbs to go')
  await expect(page.locator('[data-test="goal-line"]')).toHaveCount(1)
  await expect(page.locator('[data-test="tile-pace"]')).toContainText('/wk')

  // latest is unbounded by the selected range (BM-R14): the -45d reading falls outside 1m, but the goal tile still reflects the true latest
  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: '1m' }).click()
  await expect(page.locator('[data-test="tile-goal"]')).toContainText('13.0 lbs to go')
  await expect(page.locator('[data-test^="entry-row-"]')).toHaveCount(3)

  await goto('/body', { waitUntil: 'hydration' })
  const liveDelta = page.locator(`[data-test="metric-delta-${weight.id}"]`)
  await expect(liveDelta).toHaveText('-1.0')
  await expect(liveDelta).toHaveClass(/success/)

  await goto('/body/goals', { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="goal-card-${weight.id}"]`)).toBeVisible()
  await expect(page.locator(`[data-test="goal-remaining-${weight.id}"]`)).toContainText('13.0 lbs to go')

  await page.locator(`[data-test="goal-edit-${weight.id}"]`).click()
  await page.locator('[data-test="goal-clear"]').click()
  await page.locator('[data-test="goal-clear-confirm"]').click()
  await expect(page.locator('[data-test="goals-empty"]')).toBeVisible()

  await goto('/body', { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="metric-delta-${weight.id}"]`)).toHaveText('-1.0')
  await expect(page.locator(`[data-test="metric-delta-${weight.id}"]`)).not.toHaveClass(/success/)
})
