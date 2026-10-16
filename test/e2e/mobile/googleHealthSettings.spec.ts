import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'

test('the connected card fits at the phone width and its controls do not overlap', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', {})
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await expect(card.locator('[data-test="google-health-email"]')).toHaveText(/^stub-\d+@example\.com$/)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow).toBeLessThanOrEqual(0)

  const controls = [
    card.getByRole('button', { name: 'Sync now' }),
    card.getByRole('switch', { name: 'Import steps from Google' }),
    card.getByRole('switch', { name: 'Send my weigh-ins to Google' }),
    card.getByRole('button', { name: 'Disconnect' })
  ]
  const boxes = []
  for (const control of controls) {
    await expect(control).toBeVisible()
    boxes.push((await control.boundingBox())!)
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
      expect(overlap, `${i} overlaps ${j}`).toBe(false)
    }
  }
})
