import { expect, test } from '@nuxt/test-utils/playwright'
import type { MeasurementType } from '../../shared/types/body'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('chart markers: a day note shows as a flag on the measurement chart and its text in the tooltip', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  const bodyweight = types.find((t) => t.key === 'bodyweight')!
  const today = todayDate()
  for (const [days, value] of [
    [-6, 221.6],
    [-3, 222.9],
    [0, 220.1]
  ] as const) {
    await apiFetch(page, 'POST', '/api/body/entries', {
      typeId: bodyweight.id,
      value,
      measuredOn: shiftDate(today, days)
    })
  }
  const noted = shiftDate(today, -3)
  await apiFetch(page, 'PUT', `/api/days/${noted}/note`, { note: 'Event day, salty restaurant food' })
  await apiFetch(page, 'PUT', `/api/days/${shiftDate(today, -400)}/note`, { note: 'far outside the range' })

  await goto(`/body/${bodyweight.id}`, { waitUntil: 'hydration' })
  const marker = page.locator(`[data-test="chart-marker-${noted}"]`)
  await expect(marker).toHaveCount(1)
  await expect(page.locator('[data-test^="chart-marker-"]')).toHaveCount(1)

  const box = (await marker.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('[data-test="chart-note"]')).toHaveText('Event day, salty restaurant food')
})
