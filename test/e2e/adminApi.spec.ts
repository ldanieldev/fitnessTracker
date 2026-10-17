import type { Browser, Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { eq } from 'drizzle-orm'
import { users } from '../../server/db/schema'
import { rm } from 'node:fs/promises'
import { BORROW_RECORD, borrowAdmin, restoreAdmin } from './adminBorrow'
import { withAdminDb } from './adminDb'
import { apiFetch, makeUser, registerViaApi, tokenFetch, type TestUser } from './helpers'

interface AdminRow {
  id: number
  email: string
  isActive: boolean
  isAdmin: boolean
  providers: string[]
  tokenCount: number
  tokenLastUsedAt: string | null
}

type Goto = (url: string, opts?: { waitUntil: 'hydration' }) => Promise<unknown>

test.afterEach(async () => {
  await restoreAdmin()
})

async function adminIds() {
  return withAdminDb(async (client) => {
    const rows = await client.select({ id: users.id }).from(users).where(eq(users.isAdmin, true))
    return rows.map((r) => r.id)
  })
}

async function setupAdmin(page: Page, goto: Goto) {
  await goto('/', { waitUntil: 'hydration' })
  const admin = await registerViaApi(page, makeUser())
  await borrowAdmin(admin.email)
  const login = await apiFetch(page, 'POST', '/api/auth/login', {
    email: admin.email,
    password: admin.password
  })
  expect(login.status).toBe(200)
  const session = await apiFetch<{ user: { id: number; isAdmin: boolean } }>(page, 'GET', '/api/_auth/session')
  expect(session.json.user.isAdmin).toBe(true)
  return { admin, adminId: session.json.user.id }
}

async function newTarget(browser: Browser, base: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(new URL('/', base).toString(), { waitUntil: 'networkidle' })
  const user = await registerViaApi(page, makeUser())
  const id = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  return { context, page, user, id }
}

async function createToken(page: Page, name = 'tgt') {
  const created = await apiFetch<{ token: string; row: { id: number } }>(page, 'POST', '/api/tokens', { name })
  expect(created.status).toBe(201)
  return created.json
}

function login(page: Page, user: TestUser) {
  return apiFetch(page, 'POST', '/api/auth/login', {
    email: user.email,
    password: user.password
  })
}

test('every admin route rejects a non-admin session and a token', async ({ page, goto, playwright }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const calls: Array<[string, string]> = [
    ['GET', '/api/admin/users'],
    ['PATCH', '/api/admin/users/1'],
    ['DELETE', '/api/admin/users/1'],
    ['GET', '/api/admin/tokens'],
    ['DELETE', '/api/admin/tokens/1'],
    ['POST', '/api/nutrition/search/rebuild']
  ]
  for (const [method, path] of calls) {
    const res = await apiFetch<{ statusMessage: string }>(
      page,
      method,
      path,
      method === 'PATCH' ? { isActive: false } : undefined
    )
    expect(res.status, `${method} ${path}`).toBe(403)
    expect(res.json.statusMessage).toBe('Admin only')
  }

  const { token } = await createToken(page)
  const ctx = await playwright.request.newContext()
  try {
    const res = await tokenFetch<{ statusMessage: string }>(
      ctx,
      new URL(page.url()).origin,
      token,
      'GET',
      '/api/admin/users'
    )
    expect(res.status).toBe(403)
    expect(res.json.statusMessage).toBe('Not allowed with an access token')
  } finally {
    await ctx.dispose()
  }
})

test('admin list shape, disable and enable', async ({ page, goto, browser, playwright }) => {
  const { adminId } = await setupAdmin(page, goto)
  const base = new URL(page.url()).origin
  const target = await newTarget(browser, base)
  const ctx = await playwright.request.newContext()
  try {
    const { token } = await createToken(target.page)
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(200)

    const list = await apiFetch<AdminRow[]>(page, 'GET', '/api/admin/users')
    expect(list.status).toBe(200)
    const adminRow = list.json.find((r) => r.id === adminId)!
    const targetRow = list.json.find((r) => r.id === target.id)!
    expect(adminRow.isAdmin).toBe(true)
    expect(adminRow.tokenCount).toBe(0)
    expect(adminRow.tokenLastUsedAt).toBeNull()
    expect(targetRow.providers).toEqual(['credentials'])
    expect(targetRow.tokenCount).toBe(1)
    expect(targetRow.isActive).toBe(true)
    expect(targetRow.isAdmin).toBe(false)
    expect(new Date(targetRow.tokenLastUsedAt!).toString()).not.toBe('Invalid Date')
    for (const row of list.json) {
      expect(row).not.toHaveProperty('password')
      expect(row).not.toHaveProperty('sessionEpoch')
    }

    const off = await apiFetch(page, 'PATCH', `/api/admin/users/${target.id}`, {
      isActive: false
    })
    expect(off.status).toBe(200)
    expect(off.json).toEqual({ id: target.id, isActive: false })
    expect((await apiFetch(target.page, 'GET', '/api/tokens')).status).toBe(401)
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(401)
    const blocked = await apiFetch<{ statusMessage: string }>(target.page, 'POST', '/api/auth/login', {
      email: target.user.email,
      password: target.user.password
    })
    expect(blocked.status).toBe(403)
    expect(blocked.json.statusMessage).toBe('Account disabled')
    const after = (await apiFetch<AdminRow[]>(page, 'GET', '/api/admin/users')).json.find((r) => r.id === target.id)!
    expect(after.isActive).toBe(false)
    expect(after.tokenCount).toBe(0)
    expect(after.tokenLastUsedAt).toBeNull()

    expect(
      (
        await apiFetch(page, 'PATCH', `/api/admin/users/${target.id}`, {
          isActive: true
        })
      ).status
    ).toBe(200)
    expect((await login(target.page, target.user)).status).toBe(200)
  } finally {
    await ctx.dispose()
    await target.context.close()
  }
})

test('self, bad body and unknown id', async ({ page, goto }) => {
  const { adminId } = await setupAdmin(page, goto)
  const self = await apiFetch<{ statusMessage: string }>(page, 'PATCH', `/api/admin/users/${adminId}`, {
    isActive: false
  })
  expect(self.status).toBe(400)
  expect(self.json.statusMessage).toBe('You cannot change your own account here')
  const selfDelete = await apiFetch<{ statusMessage: string }>(page, 'DELETE', `/api/admin/users/${adminId}`)
  expect(selfDelete.status).toBe(400)
  expect(selfDelete.json.statusMessage).toBe('You cannot change your own account here')
  expect(
    (
      await apiFetch(page, 'PATCH', '/api/admin/users/2147483646', {
        isActive: 'no'
      })
    ).status
  ).toBe(400)
  expect(
    (
      await apiFetch(page, 'PATCH', '/api/admin/users/2147483646', {
        isActive: false
      })
    ).status
  ).toBe(404)
  expect((await apiFetch(page, 'DELETE', '/api/admin/users/2147483646')).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', '/api/admin/users/abc')).status).toBe(400)
  for (const [method, path] of [
    ['PATCH', '/api/admin/users/2147483648'],
    ['DELETE', '/api/admin/users/2147483648'],
    ['DELETE', '/api/admin/tokens/2147483648']
  ] as const) {
    const res = await apiFetch(page, method, path, method === 'PATCH' ? { isActive: false } : undefined)
    expect(res.status, `${method} ${path}`).toBe(400)
  }
})

test('the admin cannot delete their own account from Settings', async ({ page, goto }) => {
  const { adminId } = await setupAdmin(page, goto)
  const res = await apiFetch<{ statusMessage: string }>(page, 'DELETE', `/api/users/${adminId}`)
  expect(res.status).toBe(400)
  expect(res.json.statusMessage).toBe('Move the admin role to another account first')
  expect(await adminIds()).toEqual([adminId])
  expect((await apiFetch(page, 'GET', `/api/users/${adminId}`)).status).toBe(200)
})

test('admin lists and revokes tokens', async ({ page, goto, browser, playwright }) => {
  await setupAdmin(page, goto)
  const base = new URL(page.url()).origin
  const target = await newTarget(browser, base)
  const ctx = await playwright.request.newContext()
  try {
    const { token, row } = await createToken(target.page)
    const list = await apiFetch<Array<Record<string, unknown>>>(page, 'GET', '/api/admin/tokens')
    expect(list.status).toBe(200)
    const found = list.json.find((r) => r.id === row.id)!
    expect(found.ownerEmail).toBe(target.user.email)
    expect(found).not.toHaveProperty('userId')
    expect(found).not.toHaveProperty('tokenHash')

    expect((await apiFetch(page, 'DELETE', `/api/admin/tokens/${row.id}`)).status).toBe(204)
    expect((await tokenFetch(ctx, base, token, 'GET', '/api/export')).status).toBe(401)
    expect((await apiFetch(page, 'DELETE', `/api/admin/tokens/${row.id}`)).status).toBe(404)
  } finally {
    await ctx.dispose()
    await target.context.close()
  }
})

test('admin deletes an account', async ({ page, goto, browser }) => {
  await setupAdmin(page, goto)
  const target = await newTarget(browser, new URL(page.url()).origin)
  try {
    expect((await apiFetch(page, 'DELETE', `/api/admin/users/${target.id}`)).status).toBe(204)
    const list = await apiFetch<AdminRow[]>(page, 'GET', '/api/admin/users')
    expect(list.json.some((r) => r.id === target.id)).toBe(false)
    expect((await apiFetch(page, 'DELETE', `/api/admin/users/${target.id}`)).status).toBe(404)
    expect((await login(target.page, target.user)).status).toBe(401)
  } finally {
    await target.context.close()
  }
})

test('admin can rebuild the search index', async ({ page, goto }) => {
  await setupAdmin(page, goto)
  expect((await apiFetch(page, 'POST', '/api/nutrition/search/rebuild')).status).toBe(200)
})

// The dev DB has no admin, so a nested record (previous = a's recorded hold) is what exercises a non-null restore.
test('borrowing twice then restoring hands the flag back to the previous admin', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  const base = new URL(page.url()).origin
  const nested = BORROW_RECORD.replace(/\.json$/, '.nested.json')
  await rm(nested, { force: true })
  const original = await adminIds()
  const a = await newTarget(browser, base)
  const b = await newTarget(browser, base)
  const c = await newTarget(browser, base)
  try {
    await borrowAdmin(a.user.email)
    await borrowAdmin(b.user.email, nested)
    await borrowAdmin(c.user.email, nested)
    expect(await adminIds()).toEqual([c.id])
    await restoreAdmin(nested)
    expect(await adminIds()).toEqual([a.id])
    await borrowAdmin(b.user.email)
    await borrowAdmin(c.user.email)
    expect(await adminIds()).toEqual([c.id])
    await restoreAdmin()
    expect(await adminIds()).toEqual(original)
  } finally {
    await restoreAdmin(nested)
    await restoreAdmin()
    await Promise.all([a, b, c].map((t) => t.context.close()))
  }
})
