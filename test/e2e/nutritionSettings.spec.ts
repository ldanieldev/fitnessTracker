import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

async function logEntry(page: Page, date: string, containerId: number, nutrients: Record<string, number> = {}) {
  const res = await apiFetch(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
    { entryType: 'quick_add', containerId, description: 'Seed entry', quantity: 1, unitLabel: 'serving', nutrients }
  ])
  expect(res.ok).toBe(true)
}

test('renaming a container in settings retroactively relabels a previously logged day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/meal-containers')
  const container = containers.json[0]!
  await logEntry(page, '2026-08-01', container.id)

  await goto('/settings/nutrition', { waitUntil: 'hydration' })

  const nameInput = page.locator(`[data-test="container-name-${container.id}"]`)
  await nameInput.fill('Renamed Container')

  const [renameResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/nutrition/meal-containers/${container.id}`) && r.request().method() === 'PUT'),
    page.locator(`[data-test="container-save-${container.id}"]`).click()
  ])
  expect(renameResponse.ok()).toBe(true)

  await goto('/diary/2026-08-01', { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="container-${container.id}"]`)).toContainText('Renamed Container')
})

test('setting a new default goal profile applies to a new day but not an already-logged one', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const created = await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Original',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 2000, direction: 'max' }]
  })
  expect(created.ok).toBe(true)

  await logEntry(page, '2026-08-10', containerId)

  await goto('/settings/nutrition', { waitUntil: 'hydration' })

  const [addResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/nutrition/goal-profiles') && r.request().method() === 'POST'),
    (async () => {
      await page.locator('[data-test="add-goal-profile"]').click()
      await page.locator('[data-test="goal-name"]').fill('New Default')
      await page.locator('[data-test="goal-enable-energy"]').click()
      await page.locator('[data-test="goal-amount-energy"]').fill('1500')
      await page.locator('[data-test="goal-is-default"]').click()
      await page.locator('[data-test="goal-save"]').click()
    })()
  ])
  expect(addResponse.ok()).toBe(true)

  await goto('/diary/2026-08-15', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="energy-value"]')).toContainText('1500')

  await goto('/diary/2026-08-10', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="energy-value"]')).toContainText('2000')
})

test('tracking a nutrient adds it to the day view after client-side navigation back', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())

  // Hard nav establishes the SPA and mounts the diary page — this is the only full page load in the test.
  await goto('/diary/2026-08-20', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="sodium-state"]')).toHaveCount(0)

  // From here on: only in-app clicks and browser-back, the client-side path that left the tracked cache stale pre-fix.
  await page.getByRole('button', { name: user.name }).click()
  await page.getByRole('menuitem', { name: 'Settings' }).click()
  await page.waitForURL('**/settings/security')

  await page.getByRole('link', { name: 'Nutrition' }).click()
  await page.waitForURL('**/settings/nutrition')

  const [trackedResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/nutrition/nutrients/tracked') && r.request().method() === 'PUT'),
    (async () => {
      await page.locator('[data-test="tracked-sodium"]').click()
      await page.locator('[data-test="tracked-save"]').click()
    })()
  ])
  expect(trackedResponse.ok()).toBe(true)

  await page.goBack()
  await page.waitForURL('**/settings/security')
  await page.goBack()
  await page.waitForURL('**/diary/2026-08-20')

  await expect(page.locator('[data-test="sodium-state"]')).toBeVisible()
  await expect(page.locator('[data-test="sodium-state"]')).toHaveText('none')
})
