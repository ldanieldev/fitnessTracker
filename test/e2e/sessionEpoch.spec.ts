import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, tokenFetch } from './helpers'

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

test('a revoked session is redirected to login by the server render', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const other = await browser.newContext()
  try {
    const page2 = await other.newPage()
    await page2.goto(new URL('/auth/login', page.url()).toString())
    const credentials = { email: user.email, password: user.password }
    expect((await apiFetch(page2, 'POST', '/api/auth/login', credentials)).status).toBe(200)

    const changed = await apiFetch(page, 'PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'password456'
    })
    expect(changed.status).toBe(200)

    // Client-side 401 handling would also land on /auth/login, so assert on the server's own response.
    const ssr = await page2.evaluate(async () => (await fetch('/', { redirect: 'manual' })).type)
    expect(ssr).toBe('opaqueredirect')
    expect((await apiFetch(page2, 'GET', '/api/_auth/session')).status).toBe(401)

    await page2.goto(new URL('/', page.url()).toString())
    await expect(page2).toHaveURL(/\/auth\/login$/)
  } finally {
    await other.close()
  }
})

test('a wrong current password is a 400 that keeps the session', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const wrong = await apiFetch(page, 'PUT', '/api/auth/password', {
    currentPassword: 'not-my-password',
    newPassword: 'password456'
  })
  expect(wrong.status).toBe(400)
  expect((await apiFetch(page, 'GET', '/api/tokens')).status).toBe(200)
})

test('own password change revokes access tokens', async ({ page, goto, playwright }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const base = new URL(page.url()).origin
  const created = await apiFetch<{ token: string }>(page, 'POST', '/api/tokens', { name: 'cli' })
  const ctx = await playwright.request.newContext()
  try {
    expect((await tokenFetch(ctx, base, created.json.token, 'GET', '/api/export')).status).toBe(200)
    const changed = await apiFetch(page, 'PUT', '/api/auth/password', {
      currentPassword: user.password,
      newPassword: 'password456'
    })
    expect(changed.status).toBe(200)
    expect((await tokenFetch(ctx, base, created.json.token, 'GET', '/api/export')).status).toBe(401)
    expect((await apiFetch<unknown[]>(page, 'GET', '/api/tokens')).json).toEqual([])
  } finally {
    await ctx.dispose()
  }
})

test('session user carries isAdmin false for a non-first user', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { isAdmin: boolean }; secure?: unknown }>(page, 'GET', '/api/_auth/session')
  expect(session.json.user.isAdmin).toBe(false)
  expect(session.json).not.toHaveProperty('secure')
})
