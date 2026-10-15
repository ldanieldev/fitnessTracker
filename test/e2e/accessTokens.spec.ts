import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, tokenFetch, uniqueEmail, uniquePrefix } from './helpers'

interface TokenRow {
  id: number
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

async function setup(page: Page, goto: (url: string, opts?: { waitUntil: 'hydration' }) => Promise<unknown>) {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const base = new URL(page.url()).origin
  const userId = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  const created = await apiFetch<{ token: string; row: TokenRow }>(page, 'POST', '/api/tokens', {
    name: uniquePrefix('tok')
  })
  return { user, base, userId, token: created.json.token, row: created.json.row, created }
}

test('create and list: 201, token shown once, no hash or owner leaked, duplicate name 409', async ({ page, goto }) => {
  const { created, row, token } = await setup(page, goto)
  expect(created.status).toBe(201)
  expect(token).toMatch(/^mfj_[A-Za-z0-9_-]{43}$/)
  expect(row).not.toHaveProperty('userId')
  expect(row).not.toHaveProperty('tokenHash')

  const second = await apiFetch<{ row: TokenRow }>(page, 'POST', '/api/tokens', { name: uniquePrefix('tok') })
  const list = await apiFetch<Array<Record<string, unknown>>>(page, 'GET', '/api/tokens')
  expect(list.status).toBe(200)
  expect(list.json.map((t) => t.id)).toEqual([second.json.row.id, row.id])
  for (const entry of list.json) {
    for (const key of ['token', 'tokenHash', 'userId']) expect(entry).not.toHaveProperty(key)
  }

  const dup = await apiFetch(page, 'POST', '/api/tokens', { name: row.name })
  expect(dup.status).toBe(409)
})

test('a token reads the export and writes a goal profile', async ({ page, goto, playwright }) => {
  const { base, userId, token } = await setup(page, goto)
  const ctx = await playwright.request.newContext()
  try {
    const exported = await tokenFetch<{ tables: { users: Array<{ id: number }> } }>(
      ctx,
      base,
      token,
      'GET',
      '/api/export'
    )
    expect(exported.status).toBe(200)
    expect(exported.json.tables.users[0]!.id).toBe(userId)

    const body = (name: string) => ({
      name,
      inputMode: 'grams',
      isDefault: true,
      targets: [{ nutrient: 'energy', amount: 2000, direction: 'max' }]
    })
    const profile = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', body('Before'))
    expect(profile.status).toBeLessThan(300)
    const profilePath = `/api/nutrition/goal-profiles/${profile.json.id}`
    const renamed = await tokenFetch(ctx, base, token, 'PUT', profilePath, body('After'))
    expect(renamed.status).toBeGreaterThanOrEqual(200)
    expect(renamed.status).toBeLessThan(300)

    const profiles = await apiFetch<Array<{ id: number; name: string }>>(page, 'GET', '/api/nutrition/goal-profiles')
    expect(profiles.json.find((p) => p.id === profile.json.id)?.name).toBe('After')
  } finally {
    await ctx.dispose()
  }
})

test('lastUsedAt is set after a token call', async ({ page, goto, playwright }) => {
  const { base, token, row } = await setup(page, goto)
  expect(row.lastUsedAt).toBeNull()
  const ctx = await playwright.request.newContext()
  try {
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(200)
  } finally {
    await ctx.dispose()
  }
  const list = await apiFetch<TokenRow[]>(page, 'GET', '/api/tokens')
  expect(list.json.find((t) => t.id === row.id)?.lastUsedAt).not.toBeNull()
})

test('bad tokens get 401 and never fall back to the cookie', async ({ page, goto, playwright }) => {
  const { base, token } = await setup(page, goto)
  const ctx = await playwright.request.newContext()
  try {
    const unknown = `mfj_${'A'.repeat(43)}`
    expect((await tokenFetch(ctx, base, 'garbage', 'GET', '/api/export')).status).toBe(401)
    expect((await tokenFetch(ctx, base, unknown, 'GET', '/api/export')).status).toBe(401)
    const basic = await ctx.fetch(`${base}/api/export`, { headers: { authorization: `Basic ${token}` } })
    expect(basic.status()).toBe(401)
  } finally {
    await ctx.dispose()
  }

  const withCookie = await page.evaluate(async () => {
    const res = await fetch('/api/export', { headers: { authorization: 'Bearer junk' } })
    return res.status
  })
  expect(withCookie).toBe(401)
})

test('a revoked token stops working; revoking twice is 404', async ({ page, goto, playwright }) => {
  const { base, token, row } = await setup(page, goto)
  const ctx = await playwright.request.newContext()
  try {
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(200)
    expect((await apiFetch(page, 'DELETE', `/api/tokens/${row.id}`)).status).toBe(204)
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(401)
    expect((await apiFetch(page, 'DELETE', `/api/tokens/${row.id}`)).status).toBe(404)
  } finally {
    await ctx.dispose()
  }
})

test('account-level actions are 403 with a token and change nothing', async ({ page, goto, playwright }) => {
  const { base, token, row, userId, user } = await setup(page, goto)
  const ctx = await playwright.request.newContext()
  try {
    const attempts: Array<[string, string, unknown?]> = [
      ['DELETE', `/api/users/${userId}`],
      ['PUT', '/api/auth/password', { newPassword: 'whatever123' }],
      ['PUT', `/api/users/${userId}`, { email: uniqueEmail() }],
      ['DELETE', '/api/auth/providers/credentials'],
      ['GET', '/api/auth/providers'],
      ['GET', '/api/tokens'],
      ['POST', '/api/tokens', { name: uniquePrefix('tok') }],
      ['DELETE', `/api/tokens/${row.id}`]
    ]
    for (const [method, path, body] of attempts) {
      const res = await tokenFetch(ctx, base, token, method, path, body)
      expect(res.status, `${method} ${path}`).toBe(403)
    }

    const login = await ctx.post(`${base}/api/auth/login`, { data: { email: user.email, password: user.password } })
    expect(login.status()).toBe(200)
  } finally {
    await ctx.dispose()
  }
  const list = await apiFetch<TokenRow[]>(page, 'GET', '/api/tokens')
  expect(list.json.map((t) => t.id)).toEqual([row.id])
})

test('a token profile update does not mint a session', async ({ page, goto, playwright }) => {
  const { base, token, userId } = await setup(page, goto)
  const ctx = await playwright.request.newContext()
  try {
    const res = await tokenFetch(ctx, base, token, 'PUT', `/api/users/${userId}`, { name: 'Renamed' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeUndefined()
  } finally {
    await ctx.dispose()
  }
  const exported = await apiFetch<{ tables: { users: Array<{ name: string }> } }>(page, 'GET', '/api/export')
  expect(exported.status).toBe(200)
  expect(exported.json.tables.users[0]!.name).toBe('Renamed')
})

test('another user\'s cookie cannot revoke my token', async ({ page, goto, playwright }) => {
  const { base, token, row } = await setup(page, goto)
  const ctx = await playwright.request.newContext()
  try {
    await apiFetch(page, 'DELETE', '/api/_auth/session')
    await registerViaApi(page, makeUser())
    expect((await apiFetch(page, 'DELETE', `/api/tokens/${row.id}`)).status).toBe(404)
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(200)
  } finally {
    await ctx.dispose()
  }
})
