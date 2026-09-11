import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'

test('the day header navigates by chevrons and by the date sheet, and the FAB opens Add', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Phone Cut', inputMode: 'grams', isDefault: true, targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })

  await goto('/diary/2026-09-10', { waitUntil: 'hydration' })
  const heading = page.locator('[data-test="diary-date"]')
  await expect(heading).toHaveAttribute('data-date', '2026-09-10')
  await expect(heading).toContainText('Thu, Sep 10')
  await expect(page.getByText('Phone Cut')).toBeVisible()

  await page.getByRole('button', { name: 'Previous day' }).click()
  await expect(page).toHaveURL(/\/diary\/2026-09-09$/)

  await heading.click()
  await page.locator('[data-test="day-picker-input"]').fill('2026-08-01')
  await expect(page).toHaveURL(/\/diary\/2026-08-01$/)

  const box = await page.locator('[data-test="day-menu"]').boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(360)

  await page.locator('[data-test="fab-add"]').click()
  await expect(page).toHaveURL(/\/diary\/2026-08-01\/add$/)
})
