import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('workouts per week: defaults to 3, saves 1–7, rejects anything else', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number; workoutsPerWeek: number } }>(page, 'GET', '/api/_auth/session')
  expect(session.json.user.workoutsPerWeek).toBe(3)
  const id = session.json.user.id
  for (const bad of [0, 8, 2.5, 'four']) {
    expect((await apiFetch(page, 'PUT', `/api/users/${id}`, { workoutsPerWeek: bad })).status).toBe(400)
  }
  expect((await apiFetch(page, 'PUT', `/api/users/${id}`, { workoutsPerWeek: 5 })).status).toBe(200)
  const after = await apiFetch<{ user: { workoutsPerWeek: number } }>(page, 'GET', '/api/_auth/session')
  expect(after.json.user.workoutsPerWeek).toBe(5)
})

test('workouts per week: the settings form saves it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/workout', { waitUntil: 'hydration' })
  await page.getByLabel('Workouts per week').fill('4')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Preferences updated', { exact: true })).toBeVisible()
  const after = await apiFetch<{ user: { workoutsPerWeek: number } }>(page, 'GET', '/api/_auth/session')
  expect(after.json.user.workoutsPerWeek).toBe(4)
})
