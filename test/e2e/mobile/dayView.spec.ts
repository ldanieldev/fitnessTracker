import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'
import { todayDate } from '../../../shared/utils/nutritionSummary'

test('the day header navigates by the week strip and the date sheet, and the FAB opens Add', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Phone Cut', inputMode: 'grams', isDefault: true, targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })

  await goto('/diary/2026-09-10', { waitUntil: 'hydration' })
  const heading = page.locator('[data-test="diary-date"]')
  await expect(heading).toHaveAttribute('data-date', '2026-09-10')
  await expect(heading).toContainText('September 2026')
  await expect(page.getByText('Phone Cut')).toBeVisible()

  await page.locator('[data-test="week-day-2026-09-09"]').click()
  await expect(page).toHaveURL(/\/diary\/2026-09-09$/)

  const box = await page.locator('[data-test="day-menu"]').boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(360)

  await heading.click()
  await expect(page.locator('[data-test="day-calendar"]')).toBeVisible()
  await page.locator('[data-test="day-picker-today"]').click()
  await expect(page).toHaveURL(new RegExp(`/diary/${todayDate()}$`))

  await page.locator('[data-test="fab-add"]').click()
  await expect(page).toHaveURL(new RegExp(`/diary/${todayDate()}/add$`))
})

function localHHMM(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

test('the meal header shows the derived time, then an edited and reset time', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Time Toast',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 200 } }]
  })

  const firstEntryLoggedAt = '2026-09-11T09:00:00.000Z'
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-11/entries', [
    { entryType: 'food', containerId, foodId: food.json.id, quantity: 100, unitLabel: 'g', loggedAt: '2026-09-11T12:00:00.000Z' },
    { entryType: 'food', containerId, foodId: food.json.id, quantity: 100, unitLabel: 'g', loggedAt: firstEntryLoggedAt }
  ])

  await goto('/diary/2026-09-11', { waitUntil: 'hydration' })
  const container = page.locator(`[data-test="container-${containerId}"]`)
  const timeButton = container.locator('[data-test="container-time"]')

  const derivedLabel = localHHMM(firstEntryLoggedAt)
  await expect(timeButton).toHaveText(derivedLabel)

  await timeButton.click()
  await page.locator('[data-test="meal-time-input"]').fill('07:30')
  await page.locator('[data-test="meal-time-save"]').click()
  // The header picks up the new time from the sheet's own invalidateNutrition — no reload needed.
  await expect(timeButton).toHaveText('07:30')

  await timeButton.click()
  await page.locator('[data-test="meal-time-reset"]').click()
  await expect(timeButton).toHaveText(derivedLabel)
})
