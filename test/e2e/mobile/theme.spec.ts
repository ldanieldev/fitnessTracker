import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from '../helpers'

test('the app renders dark by default with the Graphite background', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/diary/today', { waitUntil: 'hydration' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(14, 16, 21)')
})
