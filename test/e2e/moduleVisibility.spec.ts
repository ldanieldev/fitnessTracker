import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

type ModuleFlags = { showBody: boolean, showWorkouts: boolean, showNutrition: boolean }

test('module visibility: the PUT stores the flags and rejects non-booleans', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const before = await apiFetch<{ user: ModuleFlags & { id: number } }>(page, 'GET', '/api/_auth/session')
  expect(before.json.user).toMatchObject({ showBody: true, showWorkouts: true, showNutrition: true })

  const userId = before.json.user.id
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { showWorkouts: 'no' })).status).toBe(400)
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { showWorkouts: false })).status).toBe(200)
  expect((await apiFetch(page, 'PUT', `/api/users/${userId}`, { weekStart: 0 })).status).toBe(200)

  const after = await apiFetch<{ user: ModuleFlags }>(page, 'GET', '/api/_auth/session')
  expect(after.json.user).toMatchObject({ showBody: true, showWorkouts: false, showNutrition: true })
})

test('module visibility: a hidden module leaves the sidebar, dashboard and settings tabs', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/profile', { waitUntil: 'hydration' })

  await page.getByRole('switch', { name: 'Workouts' }).click()
  await page.getByRole('button', { name: 'Save changes' }).nth(1).click()
  await expect(page.getByText('Preferences updated', { exact: true })).toBeVisible()

  const sidebar = page.locator('#dashboard-sidebar-default')
  await expect(sidebar.getByRole('link', { name: 'Log Workout' })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Diary' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Workout', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Nutrition', exact: true })).toBeVisible()

  await goto('/', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="dashboard-today"]')).toBeVisible()
  await expect(page.locator('[data-test="dashboard-workout-stats"]')).toHaveCount(0)

  const userId = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  await apiFetch(page, 'PUT', `/api/users/${userId}`, { showBody: false, showNutrition: false })
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="dashboard-empty"]')).toBeVisible()
  await expect(page.locator('[data-test="dashboard-today"]')).toHaveCount(0)
})
