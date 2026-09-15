import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from './helpers'

test('shows the viewfinder or a permission notice, and the manual path lands on the new-food page prefilled', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const today = new Date().toISOString().slice(0, 10)
  await goto(`/diary/${today}/scan`, { waitUntil: 'hydration' })

  const video = page.locator('[data-test="scan-video"]')
  const permissionNotice = page.locator('[data-test="scan-permission-notice"]')
  await expect(video.or(permissionNotice)).toBeVisible()

  await page.locator('[data-test="scan-manual-input"]').fill('0000000000000')
  await page.locator('[data-test="scan-manual-submit"]').click()

  await expect(page).toHaveURL(new RegExp(`/diary/${today}/foods/new\\?barcode=0000000000000$`))
  await expect(page.locator('[data-test="food-barcode"]')).toHaveValue('0000000000000')
})
