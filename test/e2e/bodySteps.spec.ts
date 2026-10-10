import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { StepWeek } from '../../shared/types/steps'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

test('log, replace, target, past day, goals row and sidebar', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  await apiFetch(page, 'PUT', `/api/users/${session.json.user.id}`, { weekStart: 0 })
  const today = todayDate()

  await goto('/body', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="steps-card"]')
  await expect(card.locator('[data-test="steps-set-target"]')).toBeVisible()

  await card.locator('[data-test="steps-log"]').click()
  await page.locator('input[data-test="steps-value"]').fill('6500')
  await page.locator('[data-test="steps-save"]').click()
  await expect(card.locator('[data-test="steps-today"]')).toContainText('6,500')

  await card.locator('[data-test="steps-log"]').click()
  await expect(page.locator('input[data-test="steps-value"]')).toHaveValue('6500')
  await page.locator('input[data-test="steps-value"]').fill('7200')
  await page.locator('[data-test="steps-save"]').click()
  await expect(card.locator('[data-test="steps-today"]')).toContainText('7,200')
  await expect(card.locator('[data-test="steps-total"]')).toHaveText('7,200')

  await card.locator('[data-test="steps-set-target"]').click()
  await page.locator('input[data-test="target-daily"]').fill('8000')
  await expect(page.locator('[data-test="target-weekly"]')).toContainText('56,000 per week')
  await page.locator('[data-test="target-save"]').click()
  await expect(card.locator('[data-test="steps-budget"]')).toContainText('56,000')
  await expect(card.locator('[data-test="steps-pace"]')).toBeVisible()

  await page.locator('#dashboard-sidebar-default').getByRole('link', { name: 'Steps' }).click()
  await expect(page).toHaveURL(/\/body\/steps$/)
  await expect(page.locator(`[data-test="steps-count-${today}"]`)).toHaveText('7.2k')

  await page.locator(`[data-test="steps-day-${today}"]`).click()
  const yesterday = shiftDate(today, -1)
  await page.locator('input[data-test="steps-date"]').fill(yesterday)
  await page.locator('input[data-test="steps-value"]').fill('5000')
  await page.locator('[data-test="steps-save"]').click()
  await expect(page.locator('input[data-test="steps-value"]')).toHaveCount(0)
  const weeks = await apiFetch<StepWeek[]>(page, 'GET', '/api/body/steps/weeks?count=2')
  expect(weeks.json.flatMap((w) => w.days).find((d) => d.date === yesterday)?.steps).toBe(5000)

  await goto('/body/goals', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="steps-goal-target"]')).toHaveText('8,000/day · 56,000/week')
  await page.locator('[data-test="steps-goal-edit"]').click()
  await expect(page.locator('input[data-test="target-daily"]')).toHaveValue('8000')
})
