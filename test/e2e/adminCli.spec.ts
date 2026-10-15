import { expect, test } from '@nuxt/test-utils/playwright'
import { hashAppPassword } from '../../scripts/admin'
import { authProviders, users } from '../../server/db/schema'
import { findUserIdByEmail, overwritePassword } from '../../server/utils/admin/accounts'
import { withAdminDb } from './adminDb'
import { apiFetch, makeUser, registerViaApi, tokenFetch, uniqueEmail, uniquePrefix } from './helpers'

test('set-password signs the user out everywhere and the app accepts the new hash', async ({
  page,
  goto,
  playwright
}) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const base = new URL(page.url()).origin
  const created = await apiFetch<{ token: string }>(page, 'POST', '/api/tokens', { name: uniquePrefix('tok') })
  expect(created.status).toBe(201)

  const hash = await hashAppPassword('rotated-pass-1')
  await withAdminDb(async (c) => overwritePassword(c, (await findUserIdByEmail(c, user.email))!, hash))

  expect((await apiFetch(page, 'GET', '/api/tokens')).status).toBe(401)
  const ctx = await playwright.request.newContext()
  try {
    expect((await tokenFetch(ctx, base, created.json.token, 'GET', '/api/tokens')).status).toBe(401)
  } finally {
    await ctx.dispose()
  }
  const old = await apiFetch(page, 'POST', '/api/auth/login', { email: user.email, password: user.password })
  expect(old.status).toBe(401)
  const fresh = await apiFetch(page, 'POST', '/api/auth/login', { email: user.email, password: 'rotated-pass-1' })
  expect(fresh.status).toBe(200)
})

test('set-password gives an OAuth-only account a working password', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const email = uniqueEmail('oauth')
  const hash = await hashAppPassword('rotated-pass-2')
  await withAdminDb(async (c) => {
    const [row] = await c
      .insert(users)
      .values({ email, name: 'OAuth Only', age: 0, isActive: true })
      .returning({ id: users.id })
    await c
      .insert(authProviders)
      .values({ userId: row!.id, provider: 'github', providerAccountId: uniquePrefix('gh') })
    await overwritePassword(c, row!.id, hash)
  })

  expect((await apiFetch(page, 'POST', '/api/auth/login', { email, password: 'rotated-pass-2' })).status).toBe(200)
  const providers = await apiFetch<Array<{ provider: string }>>(page, 'GET', '/api/auth/providers')
  expect(providers.json.map((p) => p.provider).sort()).toEqual(['credentials', 'github'])
})
