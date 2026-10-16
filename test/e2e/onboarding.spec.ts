import { expect, test } from '@nuxt/test-utils/playwright'
import { eq } from 'drizzle-orm'
import { users } from '../../server/db/schema'
import { withAdminDb } from './adminDb'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { apiFetch, makeUser, registerViaApi, tokenFetch } from './helpers'

test('a new user is sent to /welcome from any page until onboarding completes', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  for (const path of ['/', '/settings/profile', '/nutrition/diary/today']) {
    await goto(path, { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/welcome$/)
  }
  expect((await apiFetch(page, 'POST', '/api/onboarding/complete')).status).toBe(204)
  expect((await apiFetch(page, 'POST', '/api/onboarding/complete')).status).toBe(204)
  await goto('/settings/profile', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/settings\/profile$/)
})

test('an onboarded user visiting /welcome goes to the dashboard', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/welcome', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/$/)
  await goto('/welcome/', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/$/)
})

test('log out from /welcome lands on the login page and leaves the account un-onboarded', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  await page.locator('[data-test="onboarding-logout"]').click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  expect((await apiFetch(page, 'POST', '/api/auth/login', { email: user.email, password: user.password })).status)
    .toBe(200)
  await goto('/', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/welcome$/)
})

test('a logged-out visitor still reaches the login page', async ({ page, goto }) => {
  await goto('/welcome', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/auth\/login$/)
})

test('an access token cannot complete onboarding', async ({ page, goto, playwright }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  const created = await apiFetch<{ token: string }>(page, 'POST', '/api/tokens', { name: 'onboarding' })
  const ctx = await playwright.request.newContext()
  try {
    const origin = new URL(page.url()).origin
    const res = await tokenFetch(ctx, origin, created.json.token, 'POST', '/api/onboarding/complete')
    expect(res.status).toBe(403)
  } finally {
    await ctx.dispose()
  }
  await goto('/', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/welcome$/)
})

test('about + modules: saves the profile, drops disabled module steps, and finishes', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="onboarding-progress"]')).toHaveText('Step 1 of 6')

  await page.getByLabel('Age').fill('41')
  await page.locator('[data-test="onboarding-sex"]').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByLabel('Height feet').fill('5')
  await page.getByLabel('Height inches').fill('6')
  await page.locator('[data-test="onboarding-next"]').click()

  await expect(page.locator('[data-test="onboarding-step-modules"]')).toBeVisible()
  await page.getByRole('switch', { name: 'Nutrition' }).click()
  await page.getByRole('switch', { name: 'Body' }).click()
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-progress"]')).toHaveText('Step 3 of 4')
  await expect(page.locator('[data-test="onboarding-step-workouts"]')).toBeVisible()

  await page.locator('[data-test="onboarding-back"]').click()
  await page.getByRole('switch', { name: 'Body' }).click()
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-progress"]')).toHaveText('Step 3 of 5')
  await expect(page.locator('[data-test="onboarding-step-body"]')).toBeVisible()

  const session = await apiFetch<{ user: { id: number; age: number; sex: string; showNutrition: boolean } }>(
    page, 'GET', '/api/_auth/session'
  )
  expect(session.json.user).toMatchObject({ age: 41, sex: 'f', showNutrition: false })
  const row = await apiFetch<{ heightIn: string }>(page, 'GET', `/api/users/${session.json.user.id}`)
  expect(row.json.heightIn).toBe('66')

  await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-finish"]').click()
  await expect(page).toHaveURL(/\/$/)
  await goto('/welcome', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/$/)
})

test('about: an OAuth-style placeholder age of 0 is shown empty and must be filled', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser(), { onboard: false })
  await withAdminDb((client) => client.update(users).set({ age: 0 }).where(eq(users.email, user.email)))
  await apiFetch(page, 'POST', '/api/auth/login', { email: user.email, password: user.password })
  await goto('/welcome', { waitUntil: 'hydration' })
  await expect(page.getByLabel('Age')).toHaveValue('')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.getByText('Age is required')).toBeVisible()
  await expect(page.locator('[data-test="onboarding-step-about"]')).toBeVisible()
})

test('skip setup on the first step finishes onboarding without saving anything', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  await page.locator('[data-test="onboarding-skip-all"]').click()
  await expect(page).toHaveURL(/\/$/)
  const session = await apiFetch<{ user: { age: number; sex: string | null; onboarded: boolean } }>(
    page, 'GET', '/api/_auth/session'
  )
  expect(session.json.user).toMatchObject({ age: 30, sex: null, onboarded: true })
})

test('body: logs today’s weight once and sets a goal, even after Back and Next', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-skip"]').click()
  await expect(page.locator('[data-test="onboarding-step-body"]')).toBeVisible()

  await page.getByLabel('Current weight').fill('200')
  await page.getByLabel('Goal weight').fill('185')
  await page.getByLabel('Target date').fill(shiftDate(todayDate(), 90))
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  await page.locator('[data-test="onboarding-back"]').click()
  await expect(page.getByLabel('Current weight')).toHaveValue('200')
  await page.getByLabel('Current weight').fill('199.5')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  const types = await apiFetch<Array<{ id: number; key: string | null }>>(page, 'GET', '/api/body/types')
  const bodyweight = types.json.find((t) => t.key === 'bodyweight')!
  const entries = await apiFetch<Array<{ value: number; measuredOn: string }>>(
    page, 'GET', `/api/body/types/${bodyweight.id}/entries?to=${todayDate()}`
  )
  expect(entries.json).toEqual([expect.objectContaining({ value: 199.5, measuredOn: todayDate() })])
  const goals = await apiFetch<Array<{ type: { id: number }; goal: { targetValue: number; startValue: number } }>>(
    page, 'GET', '/api/body/goals'
  )
  const goal = goals.json.find((g) => g.type.id === bodyweight.id)?.goal
  expect(goal?.targetValue).toBe(185)
  expect(goal?.startValue).toBe(199.5)
})

test('body: clearing a saved goal removes it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.getByLabel('Current weight').fill('200')
  await page.getByLabel('Goal weight').fill('185')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  await page.locator('[data-test="onboarding-back"]').click()
  await expect(page.getByLabel('Goal weight')).toHaveValue('185')
  await page.getByLabel('Current weight').fill('199')
  await page.getByLabel('Goal weight').fill('')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  const types = await apiFetch<Array<{ id: number; key: string | null }>>(page, 'GET', '/api/body/types')
  const bodyweight = types.json.find((t) => t.key === 'bodyweight')!
  const goals = await apiFetch<Array<{ type: { id: number } }>>(page, 'GET', '/api/body/goals')
  expect(goals.json.find((g) => g.type.id === bodyweight.id)).toBeUndefined()
})

test('body: a goal without a current weight is refused', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.getByLabel('Goal weight').fill('185')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.getByText('Enter your current weight first')).toBeVisible()
  await expect(page.locator('[data-test="onboarding-step-body"]')).toBeVisible()
})

test('body: resuming on a later day advances with a blank weight and keeps the goal start', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  const types = await apiFetch<Array<{ id: number; key: string | null }>>(page, 'GET', '/api/body/types')
  const bodyweight = types.json.find((t) => t.key === 'bodyweight')!
  const yesterday = shiftDate(todayDate(), -1)
  await apiFetch(page, 'POST', '/api/body/entries', { typeId: bodyweight.id, value: 201, measuredOn: yesterday })
  await apiFetch(page, 'PUT', `/api/body/types/${bodyweight.id}/goal`, { targetValue: 185, targetDate: null })

  await goto('/welcome', { waitUntil: 'hydration' })
  await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-skip"]').click()
  await expect(page.getByLabel('Goal weight')).toHaveValue('185')
  await expect(page.getByLabel('Current weight')).toHaveValue('')
  await expect(page.getByLabel('Current weight')).toHaveAttribute('placeholder', 'Last: 201 lb')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  const goals = await apiFetch<Array<{ type: { id: number }; goal: { startDate: string; startValue: number } }>>(
    page, 'GET', '/api/body/goals'
  )
  expect(goals.json.find((g) => g.type.id === bodyweight.id)?.goal).toMatchObject({
    startDate: yesterday,
    startValue: 201
  })
})

test('nutrition: creates one default goal, renames and removes meals, and updates on Back and Next', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  for (let i = 0; i < 3; i++) await page.locator('[data-test="onboarding-skip"]').click()
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  await page.getByLabel('Calories').fill('2200')
  await page.getByLabel('Protein').fill('180')
  await page.getByLabel('Meal 1 name').fill('Breakfast')
  await page.getByRole('button', { name: 'Remove Snack' }).click()
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-workouts"]')).toBeVisible()

  await page.locator('[data-test="onboarding-back"]').click()
  await expect(page.getByLabel('Protein')).toHaveValue('180')
  await page.getByLabel('Protein').fill('190')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-workouts"]')).toBeVisible()

  const profiles = await apiFetch<
    Array<{ isDefault: boolean; calories: number; targets: Array<{ nutrient: string; amount: number }> }>
  >(page, 'GET', '/api/nutrition/goal-profiles')
  expect(profiles.json).toHaveLength(1)
  expect(profiles.json[0]).toMatchObject({ isDefault: true, calories: 2200 })
  expect(profiles.json[0]!.targets.find((t) => t.nutrient === 'protein')?.amount).toBe(190)
  const containers = await apiFetch<Array<{ name: string }>>(page, 'GET', '/api/nutrition/meal-containers')
  expect(containers.json.map((c) => c.name)).toEqual(['Breakfast', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5'])
})

test('nutrition: ratio goals need calories and all three percentages', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  for (let i = 0; i < 3; i++) await page.locator('[data-test="onboarding-skip"]').click()
  await page.locator('[data-test="onboarding-goal-mode"]').click()
  await page.getByRole('option', { name: 'Ratio (%)' }).click()
  await page.getByLabel('Protein').fill('40')
  const macros = page.locator('[data-test="onboarding-macros"]')
  await expect(macros).toContainText('Total 40%')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(macros).toContainText('Ratio goals need calories and all three percentages')
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()

  await page.getByLabel('Calories').fill('2000')
  await page.getByLabel('Carbs').fill('40')
  await page.getByLabel('Fat').fill('30')
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(macros).toContainText('Percentages must add up to 100')
  await expect(macros).not.toContainText('Total')
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()
  const profiles = await apiFetch<unknown[]>(page, 'GET', '/api/nutrition/goal-profiles')
  expect(profiles.json).toEqual([])
})

test('nutrition: two meals with the same name are refused before anything is saved', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  for (let i = 0; i < 3; i++) await page.locator('[data-test="onboarding-skip"]').click()
  await page.getByLabel('Meal 1 name').fill('Lunch')
  await page.getByLabel('Meal 2 name').fill('lunch ')
  await page.locator('[data-test="onboarding-next"]').click()
  const rows = page.locator('[data-test="onboarding-meal-row"]')
  await expect(rows.nth(1)).toContainText('Meal names must be different')
  await expect(rows.nth(0)).not.toContainText('Meal names must be different')
  await expect(page.locator('[data-test="onboarding-step-nutrition"]')).toBeVisible()
  const containers = await apiFetch<Array<{ name: string }>>(page, 'GET', '/api/nutrition/meal-containers')
  expect(containers.json.map((c) => c.name)).toEqual(['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5', 'Snack'])
})

test('workouts: saves week start, frequency, rest and plates, then finishes onto the dashboard', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser(), { onboard: false })
  await goto('/welcome', { waitUntil: 'hydration' })
  for (let i = 0; i < 4; i++) await page.locator('[data-test="onboarding-skip"]').click()
  await expect(page.locator('[data-test="onboarding-step-workouts"]')).toBeVisible()

  await page.locator('[data-test="onboarding-week-start"]').click()
  await page.getByRole('option', { name: 'Sunday' }).click()
  await page.getByLabel('Workouts per week').fill('4')
  await page.getByLabel('Default rest').fill('120')
  await page.locator('[data-test="plate-chip-35"]').click()
  await page.locator('[data-test="onboarding-next"]').click()
  await expect(page.locator('[data-test="onboarding-step-done"]')).toBeVisible()
  await expect(page.locator('[data-test="onboarding-summary-workouts"]')).toContainText('4 per week')
  await expect(page.locator('[data-test="onboarding-summary-body"]')).toContainText('Nothing set yet')

  const session = await apiFetch<{ user: Record<string, unknown> }>(page, 'GET', '/api/_auth/session')
  expect(session.json.user).toMatchObject({
    weekStart: 0,
    workoutsPerWeek: 4,
    defaultRestSeconds: 120,
    plateSizes: [45, 25, 10, 5, 2.5]
  })
  await page.locator('[data-test="onboarding-finish"]').click()
  await expect(page).toHaveURL(/\/$/)
})
