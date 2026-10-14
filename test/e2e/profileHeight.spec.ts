import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('height: saves 36–96 inches, clears with null, rejects anything else', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  const id = session.json.user.id
  for (const bad of [35.9, 96.1, '65']) {
    expect((await apiFetch(page, 'PUT', `/api/users/${id}`, { heightIn: bad })).status).toBe(400)
  }
  expect((await apiFetch(page, 'PUT', `/api/users/${id}`, { heightIn: 65.54 })).status).toBe(200)
  expect((await apiFetch<{ heightIn: string }>(page, 'GET', `/api/users/${id}`)).json.heightIn).toBe('65.5')
  expect((await apiFetch(page, 'PUT', `/api/users/${id}`, { heightIn: null })).status).toBe(200)
  expect((await apiFetch<{ heightIn: string | null }>(page, 'GET', `/api/users/${id}`)).json.heightIn).toBeNull()
})

test('user GET: only your own row', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  expect((await apiFetch(page, 'GET', `/api/users/${session.json.user.id + 1}`)).status).toBe(403)
  await apiFetch(page, 'DELETE', '/api/_auth/session')
  expect((await apiFetch(page, 'GET', `/api/users/${session.json.user.id}`)).status).toBe(401)
})

test('height: the profile form saves feet and inches and shows them again', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  await apiFetch(page, 'PUT', `/api/users/${session.json.user.id}`, { sex: 'm' })
  await goto('/settings/profile', { waitUntil: 'hydration' })
  await page.getByLabel('Height feet').fill('5')
  await page.getByLabel('Height inches').fill('5.5')
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByText('Profile updated', { exact: true })).toBeVisible()
  await goto('/settings/profile', { waitUntil: 'hydration' })
  await expect(page.getByLabel('Height feet')).toHaveValue('5')
  await expect(page.getByLabel('Height inches')).toHaveValue('5.5')
})

test('user list: no route returns accounts, signed in or not', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const signedIn = await apiFetch(page, 'GET', '/api/users')
  expect(Array.isArray(signedIn.json)).toBe(false)
  expect(JSON.stringify(signedIn.json)).not.toContain(user.email)
  await apiFetch(page, 'DELETE', '/api/_auth/session')
  const anonymous = await apiFetch(page, 'GET', '/api/users')
  expect(Array.isArray(anonymous.json)).toBe(false)
  expect(JSON.stringify(anonymous.json)).not.toContain(user.email)
})

test('user create: only registration makes accounts, and registering an existing email is refused', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  const email = `create-route-${Date.now()}@example.com`
  await apiFetch(page, 'POST', '/api/users', { name: '', email, password: 'x', age: 999 })
  const login = await page.evaluate(
    async (body) =>
      (await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })).status,
    { email, password: 'x' }
  )
  expect(login).not.toBe(200)

  const user = await registerViaApi(page, makeUser())
  await apiFetch(page, 'DELETE', '/api/_auth/session')
  const again = await apiFetch(page, 'POST', '/api/auth/register', {
    name: 'Someone Else',
    email: user.email,
    password: 'another-password',
    age: 30
  })
  expect(again.status).toBe(409)
  expect((await apiFetch<{ user?: unknown }>(page, 'GET', '/api/_auth/session')).json.user).toBeUndefined()
})
