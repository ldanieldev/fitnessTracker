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

export interface ApiResult<T = unknown> {
  status: number
  ok: boolean
  json: T
}

export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (value: T) => boolean,
  { intervalMs = 500, timeoutMs = 15000 } = {}
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last: T
  do {
    last = await fn()
    if (predicate(last)) return last
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  } while (Date.now() < deadline)
  return last
}

export interface SeedServingInput {
  kind: 'weight' | 'named'
  label: string
  quantity: number
  basisGrams?: number | null
  nutrients?: Record<string, number>
}

/** Seeds a catalogue food (createdByUserId null) via the test-only fixture route. */
export async function seedCatalogFood(
  page: Page,
  body: { name: string, brand?: string | null, barcode?: string | null, servings: SeedServingInput[] }
): Promise<{ id: number }> {
  return (await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/_test/catalog-food', body)).json
}

/** Authenticated calls must run inside the page: page.request drops the SameSite=Lax cookie on test-utils' 127.0.0.1 host. */
export async function apiFetch<T = unknown>(page: Page, method: string, path: string, body?: unknown): Promise<ApiResult<T>> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
      const text = await res.text()
      let json: unknown
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        json = text
      }
      return { status: res.status, ok: res.ok, json }
    },
    { method, path, body }
  ) as Promise<ApiResult<T>>
}
