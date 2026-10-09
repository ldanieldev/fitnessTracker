import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import type { Exercise, WorkoutSession } from '../../shared/types/workout'

test('history, graph, records and progress from the UI', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  // Relative dates, plus the explicit "All" range selection below: MTD default would empty out around the 1st.
  const today = todayDate()
  const log = async (performedOn: string, weight: number) => {
    const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    const entry = (
      await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
        exerciseId: bench.id
      })
    ).json.entries[0]!
    await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight, reps: 5 })
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  }
  await log(shiftDate(today, -15), 185)
  await log(shiftDate(today, -8), 205)

  // The log screen's history button links here with ?tab=history, so the page must open on that tab unclicked.
  await goto(`/workouts/exercises/${bench.id}?tab=history`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="history-set"]').first()).toContainText('205 lb × 5')

  await goto(`/workouts/exercises/${bench.id}`, { waitUntil: 'hydration' })

  await page.locator('[data-test="exercise-tab-history"]').click()
  await expect(page.locator('[data-test="history-set"]').first()).toContainText('205 lb × 5')
  await expect(page.locator('[data-test="history-record"]').first()).toBeVisible()

  await page.locator('[data-test="exercise-tab-graph"]').click()
  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: 'All' }).click()
  // A hairline SVG path can be legitimately zero-area, so check it visits 2+ distinct x-coordinates, not toBeVisible().
  // Polled: until the All fetch lands the MTD path is still drawn, which holds one point on days 9–15 of a month.
  const rawPath = page.locator('[data-test="metric-chart"] [data-test="raw-path"]')
  const distinctXs = async () =>
    new Set([...((await rawPath.getAttribute('d')) ?? '').matchAll(/[ML](-?[\d.]+)/g)].map((m) => m[1])).size
  await expect.poll(distinctXs).toBeGreaterThanOrEqual(2)

  await page.locator('[data-test="graph-goal"]').click()
  await page.locator('[data-test="goal-target"]').fill('225')
  await page.locator('[data-test="goal-save"]').click()
  const goalLine = page.locator('[data-test="goal-line"]')
  await expect(goalLine).toBeAttached()
  const y1 = Number(await goalLine.getAttribute('y1'))
  // Plot-area bounds aren't exposed via a hook, so this checks placement within the chart's rendered height instead.
  const chartHeight = Number(await page.locator('[data-test="metric-chart"] svg').getAttribute('height'))
  expect(y1).not.toBeNaN()
  expect(y1).toBeGreaterThanOrEqual(0)
  expect(y1).toBeLessThanOrEqual(chartHeight)

  await page.locator('[data-test="exercise-tab-records"]').click()
  await expect(page.locator('[data-test="record-card"]').first()).toContainText('205')
  await expect(page.locator('[data-test="rep-max-row"]')).toHaveCount(15)

  await goto('/workouts/progress', { waitUntil: 'hydration' })
  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: 'All' }).click()
  await expect(page.locator('[data-test="progress-total-workouts"]')).toContainText('2')
  await expect(page.locator('[data-test="muscle-bar-fill"]').first()).toBeVisible()
  await expect(page.locator('[data-test="progress-goal"]').first()).toContainText('225')
})
