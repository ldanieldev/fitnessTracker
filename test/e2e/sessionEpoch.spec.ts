import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('own password change signs out other browsers, not this one', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const other = await browser.newContext()
  try {
    const page2 = await other.newPage()
    await page2.goto(new URL('/auth/login', page.url()).toString())
    const credentials = { email: user.email, password: user.password }
    expect((await apiFetch(page2, 'POST', '/api/auth/login', credentials)).status).toBe(200)
    expect((await apiFetch(page2, 'GET', '/api/tokens')).status).toBe(200)

    const changed = await apiFetch(page, 'PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'password456'
    })
    expect(changed.status).toBe(200)
    expect((await apiFetch(page, 'GET', '/api/tokens')).status).toBe(200)
    expect((await apiFetch(page2, 'GET', '/api/tokens')).status).toBe(401)

    const relogin = await apiFetch(page2, 'POST', '/api/auth/login', { email: user.email, password: 'password456' })
    expect(relogin.status).toBe(200)
    expect((await apiFetch(page2, 'GET', '/api/tokens')).status).toBe(200)
  } finally {
    await other.close()
  }
})

test('session user carries isAdmin false for a non-first user', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { isAdmin: boolean }; secure?: unknown }>(page, 'GET', '/api/_auth/session')
  expect(session.json.user.isAdmin).toBe(false)
  expect(session.json).not.toHaveProperty('secure')
})
