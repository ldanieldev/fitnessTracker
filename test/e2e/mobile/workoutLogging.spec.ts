import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi, uniquePrefix } from '../helpers'

test.use({ viewport: { width: 390, height: 844 } })

// Logging a set starts the rest countdown in the header pill; the drawer stays closed so the card keeps taking taps.
async function expectRestPill(page: Page) {
  await expect(page.locator('[data-test="rest-timer-pill"]')).toBeVisible()
  await expect(page.locator('[data-test="rest-timer"]')).toHaveCount(0)
}

async function pickMenuItem(page: Page, menu: string, item: string) {
  await page.locator(`[data-test="${menu}"]`).click()
  await page.locator(`[data-test="${item}"]`).click()
}

test('phone: start a workout, log sets, set a record, edit, collapse, end, copy and revisit', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Phone Day ')

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await page.locator('[data-test="start-empty"]').click()
  await page.locator('[data-test="session-name"]').fill(name)
  await page.locator('[data-test="session-name"]').blur()

  await page.locator('[data-test="entry-add"]').click()
  await expect(page.locator('[data-test="exercise-search"]')).toBeFocused()
  await page.locator('[data-test="exercise-search"]').fill('barbell bench press')
  await page.locator('[data-test="exercise-list"] [data-test="exercise-row"]').first().click()

  await expect(page.locator('[data-test="set-form-heading"]')).toHaveText('Set 1')
  await page.locator('[data-test="set-weight-new"]').fill('185')
  await page.locator('[data-test="set-reps-new"]').fill('8')
  await page.locator('[data-test="set-save-new"]').click()
  await expect(page.locator('[data-test="set-row"]')).toHaveCount(1)
  await expect(page.locator('[data-test^="set-record-"]')).toHaveCount(0)
  await expect(page.locator('[data-test="set-form-heading"]')).toHaveText('Set 2')
  await expectRestPill(page)
  await page.locator('[data-test="rest-timer-pill"]').click()
  await expect(page.locator('[data-test="rest-timer"]')).toBeVisible()
  await page.locator('[data-vaul-overlay]').click({ position: { x: 10, y: 10 } })
  await expect(page.locator('[data-test="rest-timer"]')).toHaveCount(0)

  await page.locator('[data-test="set-weight-new"]').fill('205')
  await page.locator('[data-test="set-save-new"]').click()
  await expect(page.locator('[data-test="set-row"]')).toHaveCount(2)
  await expect(page.locator('[data-test^="set-record-"]')).toHaveCount(1)
  await expectRestPill(page)

  const firstRow = page.locator('[data-test="set-row"]').first()
  const firstId = (await firstRow.locator('[data-test^="set-line-"]').getAttribute('data-test'))!.replace('set-line-', '')
  await pickMenuItem(page, `set-menu-${firstId}`, `set-edit-${firstId}`)
  await page.locator(`[data-test="set-weight-${firstId}"]`).fill('190')
  await page.locator(`[data-test="set-save-${firstId}"]`).click()
  await expect(page.locator(`[data-test="set-measure-${firstId}-weight"]`)).toHaveText('190 lb')

  const cardId = (await page.locator('[data-test^="entry-card-"]').first().getAttribute('data-test'))!.replace('entry-card-', '')
  await page.locator(`[data-test="entry-collapse-${cardId}"]`).click()
  await expect(page.locator('[data-test="set-form"]')).toHaveCount(0)
  await page.locator(`[data-test="entry-collapse-${cardId}"]`).click()
  await expect(page.locator('[data-test="set-form"]')).toHaveCount(1)

  await page.locator('[data-test="session-finish"]').click()
  await expect(page.locator('[data-test="start-empty"]')).toBeVisible()

  await goto('/workouts/sessions?view=list', { waitUntil: 'hydration' })
  const row = page.locator('[data-test="session-row"]').filter({ hasText: name })
  await expect(row).toHaveCount(1)
  await row.locator('[data-test^="session-copy-"]').click()
  await page.locator('[data-test="copy-start"]').click()
  await expect(page.locator('[data-test="set-weight-new"]')).toHaveValue('205')

  await page.locator('[data-test="session-finish"]').click()
  await goto('/workouts/sessions?view=list', { waitUntil: 'hydration' })
  await page.locator('[data-test="session-row"]').filter({ hasText: name }).locator('a').click()
  await expect(page.locator('[data-test="set-row"]')).not.toHaveCount(0)
})
