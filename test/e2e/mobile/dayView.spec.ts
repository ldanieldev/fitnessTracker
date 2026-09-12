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

test('the meal header add button opens the add flow for that container', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  await goto('/diary/2026-09-10', { waitUntil: 'hydration' })
  const container = page.locator(`[data-test="container-${containerId}"]`)
  const headerAdd = container.locator('[data-test="container-header"] [data-test="container-add"]')
  await expect(headerAdd).toHaveCount(1)

  await headerAdd.click()
  await expect(page).toHaveURL(new RegExp(`/diary/2026-09-10/add\\?containerId=${containerId}$`))
})
