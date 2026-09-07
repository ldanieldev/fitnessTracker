import type { Page } from '@playwright/test'

/** Unique per-run email — the e2e DB persists between runs, so registration tests must not collide on users.email. */
export function uniqueEmail(prefix = 'e2e') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`
}

export interface TestUser {
  name: string
  email: string
  password: string
  age: number
}

export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return { name: 'E2E User', email: uniqueEmail(), password: 'password123', age: 30, ...overrides }
}

/**
 * Register through the API instead of the multi-field form. The endpoint calls setUserSession, and page.request shares
 * its cookie jar with the browser context, so the page is authenticated afterwards. Requires a prior goto() so
 * page.url() has a real origin to resolve against.
 */
export async function registerViaApi(page: Page, user: TestUser) {
  const base = new URL(page.url()).origin
  const res = await page.request.post(`${base}/api/auth/register`, {
    data: { name: user.name, email: user.email, password: user.password, age: user.age }
  })
  if (!res.ok()) throw new Error(`register failed: ${res.status()} ${await res.text()}`)
  return user
}
