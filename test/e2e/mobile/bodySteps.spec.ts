import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'
import { todayDate } from '../../../shared/utils/nutritionSummary'

test('phone: log from the card drawer and the steps page fits 360 px', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'PUT', '/api/body/steps/target', { dailyTarget: 8000, effectiveFrom: '2026-01-04' })

  await goto('/body', { waitUntil: 'hydration' })
  await page.locator('[data-test="steps-log"]').click()
  await page.locator('input[data-test="steps-value"]').fill('123456')
  await page.locator('[data-test="steps-save"]').click()
  await expect(page.locator('[data-test="steps-today"]')).toContainText('123,456')

  await goto('/body/steps', { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="steps-count-${todayDate()}"]`)).toHaveText('123.4k')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
