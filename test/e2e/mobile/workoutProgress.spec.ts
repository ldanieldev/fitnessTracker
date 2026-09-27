import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'
import type { Exercise, WorkoutSession } from '../../../shared/types/workout'

test('progress reads on a phone', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  const entry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: bench.id
  })).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 185, reps: 8 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })

  await goto(`/workouts/exercises/${bench.id}`, { waitUntil: 'hydration' })
  await page.locator('[data-test="exercise-tab-graph"]').click()
  const chart = page.locator('[data-test="metric-chart"]')
  await expect(chart).toBeVisible()
  expect((await chart.boundingBox())!.width).toBeLessThanOrEqual(360)

  await goto('/workouts/progress', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="progress-total-sets"]')).toContainText('1')
  // Nothing may overflow the viewport at 360 px.
  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))
  expect(overflow).toBeLessThanOrEqual(0)
})
