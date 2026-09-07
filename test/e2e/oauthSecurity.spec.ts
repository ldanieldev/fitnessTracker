import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from './helpers'

// Browser-side surface of server/utils/oauthRedirect plus the unlink guard — every branch but the provider handshake.

// loginError() redirects to /auth/login?error=<code>; login.vue maps the code to a toast, then clears the param.
test.describe('OAuth login-error surface', () => {
  test('shows the mapped error toast for ?error=already_linked', async ({ page, goto }) => {
    await goto('/auth/login?error=already_linked', { waitUntil: 'hydration' })
    // exact:true scopes to the visible toast, not the aria-live region mirroring the same text.
    await expect(page.getByText('That account is already linked to a different user.', { exact: true })).toBeVisible()
  })

  test('ignores an unknown error code (no error toast)', async ({ page, goto }) => {
    await goto('/auth/login?error=bogus', { waitUntil: 'hydration' })
    await expect(page.getByText('Login failed')).toHaveCount(0)
  })
})

// oauthSuccessRedirect() returns to /settings/security?linked=<provider>; auth-protected, so register first.
test.describe('OAuth link-success surface', () => {
  test('shows a success toast for ?linked=github on the security page', async ({ page, goto }) => {
    const user = makeUser()
    await goto('/auth/login', { waitUntil: 'hydration' })
    await registerViaApi(page, user)

    await goto('/settings/security?linked=github', { waitUntil: 'hydration' })
    await expect(page.getByText('github linked', { exact: true })).toBeVisible()
  })
})

// Asserted at the API level: the guard lives in the DELETE route and the UI never renders Unlink for credentials-only.
test.describe('unlink guard', () => {
  test('refuses to unlink the only authentication method (400)', async ({ page, goto }) => {
    const user = makeUser()
    await goto('/auth/login', { waitUntil: 'hydration' })
    await registerViaApi(page, user)

    const base = new URL(page.url()).origin
    const res = await page.request.delete(`${base}/api/auth/providers/credentials`)

    expect(res.status()).toBe(400)
    expect(await res.text()).toContain('Cannot unlink your only authentication method')
  })
})
