import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi, uniquePrefix } from '../helpers'

test.use({ viewport: { width: 390, height: 844 } })

// Logging a set opens the rest timer, whose overlay swallows clicks on the card until it is dismissed.
async function dismissRestTimer(page: Page) {
  await expect(page.locator('[data-test="rest-timer"]')).toBeVisible()
  // the drawer closes on a tap outside it, and the overlay is the only thing outside it that can be tapped.
  await page.locator('[data-vaul-overlay]').click({ position: { x: 10, y: 10 } })
  await expect(page.locator('[data-test="rest-timer"]')).toHaveCount(0)
}

test('phone: start a workout, log sets, set a record, finish, copy and edit', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Phone Day ')

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await page.locator('[data-test="start-empty"]').click()
  await page.locator('[data-test="session-name"]').fill(name)
  await page.locator('[data-test="session-name"]').blur()

  await page.locator('[data-test="entry-add"]').click()
  await page.locator('[data-test="exercise-search"]').fill('barbell bench press')
  await page.locator('[data-test="exercise-list"] [data-test="exercise-row"]').first().click()

  await page.locator('[data-test="set-weight-new"]').fill('185')
  await page.locator('[data-test="set-reps-new"]').fill('8')
  await page.locator('[data-test="set-save-new"]').click()
  await expect(page.locator('[data-test="set-row"]')).toHaveCount(2)
  await expect(page.locator('[data-test^="set-record-"]')).toHaveCount(1)
  await dismissRestTimer(page)

  await page.locator('[data-test="set-weight-new"]').fill('205')
  await page.locator('[data-test="set-save-new"]').click()
  await expect(page.locator('[data-test="set-row"]')).toHaveCount(3)
  await expect(page.locator('[data-test^="set-record-"]')).toHaveCount(2)
  await dismissRestTimer(page)

  await page.locator('[data-test="session-finish"]').click()
  await expect(page.locator('[data-test="start-empty"]')).toBeVisible()

  await goto('/workouts/sessions', { waitUntil: 'hydration' })
  const row = page.locator('[data-test="session-row"]').filter({ hasText: name })
  await expect(row).toHaveCount(1)
  await row.locator('[data-test^="session-copy-"]').click()
  await expect(page.locator('[data-test="set-weight-new"]')).toHaveValue('205')

  await page.locator('[data-test="session-finish"]').click()
  await goto('/workouts/sessions', { waitUntil: 'hydration' })
  await page.locator('[data-test="session-row"]').filter({ hasText: name }).locator('a').click()
  await expect(page.locator('[data-test="set-row"]')).not.toHaveCount(0)
})
