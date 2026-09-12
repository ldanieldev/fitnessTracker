import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from './helpers'

test('the month title opens a real calendar on desktop and picking a day navigates', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/diary/2026-09-10', { waitUntil: 'hydration' })
  await page.locator('[data-test="diary-date"]').click()
  await expect(page.locator('[data-test="day-calendar"]')).toBeVisible()
  await page.locator('[data-test="day-calendar"]').getByRole('button', { name: /September 3,/ }).click()
  await expect(page).toHaveURL(/\/diary\/2026-09-03$/)
})
