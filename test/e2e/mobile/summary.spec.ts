import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from '../helpers'

test('the summary range trigger does not overlap the sidebar toggle', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/diary/summary', { waitUntil: 'hydration' })

  const toggle = page.getByRole('button', { name: 'Open sidebar' })
  const trigger = page.getByRole('button', { name: /–|^Pick a date$/ })
  await expect(toggle).toBeVisible()
  await expect(trigger).toBeVisible()

  const toggleBox = await toggle.boundingBox()
  const triggerBox = await trigger.boundingBox()
  expect(toggleBox).not.toBeNull()
  expect(triggerBox).not.toBeNull()

  const overlaps = triggerBox!.x < toggleBox!.x + toggleBox!.width
    && triggerBox!.x + triggerBox!.width > toggleBox!.x
    && triggerBox!.y < toggleBox!.y + toggleBox!.height
    && triggerBox!.y + triggerBox!.height > toggleBox!.y
  expect(overlaps).toBe(false)
})
