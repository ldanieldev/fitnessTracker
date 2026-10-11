import { expect, test } from '@nuxt/test-utils/playwright'
import { format } from 'date-fns'
import { makeUser, registerViaApi } from '../helpers'
import { shiftDate, todayDate } from '../../../shared/utils/nutritionSummary'

test('tapping a calendar day shows its date, and tapping elsewhere hides it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })

  const day = shiftDate(todayDate(), -2)
  for (const card of ['consistency', 'nutrition']) {
    const calendar = page.locator(`[data-test="dashboard-${card}"] [data-test="calendar"]`)
    await calendar.scrollIntoViewIfNeeded()
    await calendar.locator(`[data-day="${day}"]`).tap()
    const tip = calendar.locator('[data-test="calendar-tip"]')
    await expect(tip).toHaveText(format(new Date(`${day}T00:00:00`), 'EEE, MMM d'))
    await expect(tip).toBeInViewport({ ratio: 1 })
    await page.locator(`[data-test="dashboard-${card}"] h2`).tap()
    await expect(tip).toHaveCount(0)
  }

  const calendar = page.locator('[data-test="dashboard-consistency"] [data-test="calendar"]')
  await calendar.locator('[data-day]:not([data-future="true"])').last().tap()
  const box = (await calendar.boundingBox())!
  const tip = (await calendar.locator('[data-test="calendar-tip"]').boundingBox())!
  expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width + 1)
})
