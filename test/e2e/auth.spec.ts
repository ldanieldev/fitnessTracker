import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi, uniqueEmail } from './helpers'

// Auth guard + credentials register/login/logout. No real OAuth provider, so these run unattended in CI.

test.describe('auth guard', () => {
  test('redirects an unauthenticated visit to a protected route to /auth/login', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await expect(page).toHaveURL(/\/auth\/login/)
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
