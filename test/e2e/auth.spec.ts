import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniqueEmail } from './helpers'

// Auth guard + credentials register/login/logout. No real OAuth provider, so these run unattended in CI.

test.describe('auth guard', () => {
  test('redirects an unauthenticated visit to a protected route to /auth/login', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('stale session', () => {
  test('a cookie outliving its user row 401s and lands on login, not a 500', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    // Deletes only the calling session's own user row — the one test-only exception to never deleting rows.
    const del = await apiFetch(page, 'POST', '/api/nutrition/_test/delete-user')
    expect(del.ok).toBe(true)

    await goto('/nutrition/diary/today', { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('a raw $fetch mutation on an already-open page 401s and lands on login, not just a toast', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    // The nutrient catalogue is fetched lazily after hydration; if it lands after the delete it 401s and redirects first, pre-empting the mutation under test.
    const catalogLoaded = page.waitForResponse((r) => r.url().includes('/api/nutrition/nutrients'))
    await goto('/nutrition/diary/today', { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/nutrition\/diary\/\d{4}-\d{2}-\d{2}$/)
    await catalogLoaded

    // Deletes only the calling session's own user row — the one test-only exception to never deleting rows.
    const del = await apiFetch(page, 'POST', '/api/nutrition/_test/delete-user')
    expect(del.ok).toBe(true)

    // Day notes save is a raw $fetch call (not useNutritionFetch) — the page was already open before the row disappeared.
    await page.locator('[data-test="day-menu"]').click()
    await page.getByRole('menuitem', { name: 'Day notes' }).click()
    await page.locator('[data-test="day-notes-input"]').fill('Should not save')
    await page.locator('[data-test="day-notes-save"]').click()

    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByText('Save failed', { exact: true })).toHaveCount(0)
  })
})

test.describe('credentials register / login / logout', () => {
  test('a newly registered account lands authenticated on the dashboard', async ({ page, goto }) => {
    const user = makeUser()
    await goto('/auth/login', { waitUntil: 'hydration' })
    // The register form's `sex` select never reaches UAuthForm's validation state, so the form can't be automated.
    await registerViaApi(page, user)
    await goto('/', { waitUntil: 'hydration' })

    await expect(page).not.toHaveURL(/\/auth\//)
    await expect(page.getByRole('button', { name: user.name })).toBeVisible()
  })

  test('logs in with valid credentials and reaches the dashboard', async ({ page, goto }) => {
    const user = makeUser()
    await goto('/auth/login', { waitUntil: 'hydration' })
    // Seed via the API, then drop that session so the login *form* runs against an existing user.
    await registerViaApi(page, user)
    await page.context().clearCookies()
    await goto('/auth/login', { waitUntil: 'hydration' })

    await page.getByPlaceholder('Enter your email').fill(user.email)
    await page.getByPlaceholder('Enter your password').fill(user.password)
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page).not.toHaveURL(/\/auth\//)
    await expect(page.getByRole('button', { name: user.name })).toBeVisible()
  })

  test('shows an error toast and stays on the login page for bad credentials', async ({ page, goto }) => {
    await goto('/auth/login', { waitUntil: 'hydration' })

    await page.getByPlaceholder('Enter your email').fill(uniqueEmail('nope'))
    await page.getByPlaceholder('Enter your password').fill('wrongpassword') // ≥8 chars to pass client validation
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText('Login failed', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('logs out via the user menu and re-blocks protected routes', async ({ page, goto }) => {
    const user = makeUser()
    await goto('/auth/login', { waitUntil: 'hydration' })
    await registerViaApi(page, user)
    await goto('/', { waitUntil: 'hydration' })

    await page.getByRole('button', { name: user.name }).click()
    await page.getByRole('menuitem', { name: 'Log out' }).click()

    // The default layout watches loggedIn and redirects on sign-out.
    await expect(page).toHaveURL(/\/auth\/login/)
    await goto('/', { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})

test.describe('user preferences', () => {
  test('saves a default rest of 30s into the session and rejects one below the floor', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const before = await apiFetch<{ user: { id: number, defaultRestSeconds: number } }>(page, 'GET', '/api/_auth/session')
    expect(before.json.user.defaultRestSeconds).toBe(60)

    const saved = await apiFetch(page, 'PUT', `/api/users/${before.json.user.id}`, { defaultRestSeconds: 30 })
    expect(saved.status).toBe(200)
    const after = await apiFetch<{ user: { defaultRestSeconds: number } }>(page, 'GET', '/api/_auth/session')
    expect(after.json.user.defaultRestSeconds).toBe(30)

    const rejected = await apiFetch(page, 'PUT', `/api/users/${before.json.user.id}`, { defaultRestSeconds: 5 })
    expect(rejected.status).toBe(400)
  })

  test('plate sizes default on the session and save normalised', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())
    const before = await apiFetch<{ user: { id: number, plateSizes: number[] } }>(page, 'GET', '/api/_auth/session')
    expect(before.json.user.plateSizes).toEqual([45, 35, 25, 10, 5, 2.5])

    const saved = await apiFetch(page, 'PUT', `/api/users/${before.json.user.id}`, { plateSizes: [2.5, 55, 45] })
    expect(saved.status).toBe(200)
    const after = await apiFetch<{ user: { plateSizes: number[] } }>(page, 'GET', '/api/_auth/session')
    expect(after.json.user.plateSizes).toEqual([55, 45, 2.5])

    for (const bad of [[], [0], [101], [45, 45], [1.125]]) {
      expect((await apiFetch(page, 'PUT', `/api/users/${before.json.user.id}`, { plateSizes: bad })).status).toBe(400)
    }
  })
})
