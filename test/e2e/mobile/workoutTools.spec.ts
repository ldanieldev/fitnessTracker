import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'
import type { Exercise } from '../../../shared/types/workout'

test('phone: a logged set starts the exercise rest in the pill, and tools open from the header', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${bench.id}/prefs`, { restSeconds: 20 })

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await page.locator('[data-test="start-empty"]').click()
  await page.locator('[data-test="entry-add"]').click()
  await page.locator('[data-test="exercise-search"]').fill('barbell bench press')
  await page.locator('[data-test="exercise-list"] [data-test="exercise-row"]').first().click()
  await page.locator('[data-test="set-weight-new"]').fill('185')
  await page.locator('[data-test="set-reps-new"]').fill('5')
  await page.locator('[data-test="set-save-new"]').click()

  const pill = page.locator('[data-test="rest-timer-pill"]')
  await expect(pill).toBeVisible()
  await expect(pill).toContainText(/00:(1\d|20)/)
  await expect(page.locator('[data-test="rest-timer"]')).toHaveCount(0)

  await page.locator('[data-test="tools-open"]').click()
  await expect(page.locator('[data-test="tools-sheet"]')).toBeVisible()
  await page.locator('[data-test="tools-tab-one-rep-max"]').click()
  await expect(page.locator('[data-test="one-rep-max-estimate"]')).toContainText('208.1')
  await page.screenshot({ path: 'test-results/workout-tools-360.png', fullPage: false })
})
