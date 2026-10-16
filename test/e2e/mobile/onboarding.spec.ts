import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from '../helpers'

test('every onboarding step fits the phone width without sideways scrolling', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  for (const step of ['about', 'modules', 'body', 'nutrition', 'workouts', 'done']) {
    await expect(page.locator(`[data-test="onboarding-step-${step}"]`)).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, step).toBeLessThanOrEqual(0)
    if (step !== 'done') await page.locator('[data-test="onboarding-skip"]').click()
  }
})
