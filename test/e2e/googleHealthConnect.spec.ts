import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, tokenFetch, uniquePrefix } from './helpers'
import type { GoogleHealthStatus } from '../../shared/types/googleHealth'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

test('connect redirects a signed-in user to Google and refuses an anonymous one', async ({
  page,
  goto,
  request
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const type = await page.evaluate(async () => {
    const res = await fetch('/api/integrations/google-health/connect', { redirect: 'manual' })
    return res.type
  })
  expect(type).toBe('opaqueredirect')
  const base = new URL(page.url()).origin
  const anon = await request.get(`${base}/api/integrations/google-health/connect`, { maxRedirects: 0 })
  expect(anon.status()).toBe(401)
})

test('toggles update the connection; disconnect removes it and keeps synced data', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const refreshToken = uniquePrefix('disconnect-')
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { refreshToken })
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')

  const patched = await apiFetch<GoogleHealthStatus>(page, 'PATCH', '/api/integrations/google-health', {
    syncSteps: true,
    pushWeight: true
  })
  expect(patched.json.connection).toMatchObject({ syncSteps: true, pushWeight: true })

  expect((await apiFetch(page, 'DELETE', '/api/integrations/google-health')).status).toBe(200)
  const revokes = (await apiFetch<string[]>(page, 'GET', '/api/integrations/_test/google-health/revokes')).json
  expect(revokes).toContain(refreshToken)
  const status = await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')
  expect(status.json.connection).toBeNull()
  const types = (await apiFetch<{ id: number; key: string | null }[]>(page, 'GET', '/api/body/types')).json
  const hrv = types.find((t) => t.key === 'hrv')!
  expect((await apiFetch<unknown[]>(page, 'GET', `/api/body/types/${hrv.id}/entries`)).json.length).toBe(3)
})

test('an access token can read status and sync, but not connect, toggle or disconnect', async ({
  page,
  goto,
  request
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', {})
  const created = await apiFetch<{ token: string }>(page, 'POST', '/api/tokens', { name: 'gh' })
  const base = new URL(page.url()).origin
  const token = created.json.token

  expect((await tokenFetch(request, base, token, 'GET', '/api/integrations/google-health')).status).toBe(200)
  expect((await tokenFetch(request, base, token, 'POST', '/api/integrations/google-health/sync')).status).toBe(200)
  expect((await tokenFetch(request, base, token, 'GET', '/api/integrations/google-health/connect')).status).toBe(403)
  expect(
    (await tokenFetch(request, base, token, 'PATCH', '/api/integrations/google-health', { syncSteps: true })).status
  ).toBe(403)
  expect((await tokenFetch(request, base, token, 'DELETE', '/api/integrations/google-health')).status).toBe(403)
  const status = await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')
  expect(status.json.connection).toMatchObject({ syncSteps: false })
})

test('the full first sync runs through the per-user function body', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { syncSteps: true })
  const res = await apiFetch<{ outcome: string }>(page, 'POST', '/api/integrations/_test/run-google-health-sync', {
    full: true
  })
  expect(res.json).toMatchObject({ outcome: 'ok', counts: { hrv: 3, steps: 3 } })
})

test('a full sync does not delete google step rows older than the range it fetched', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const old = shiftDate(todayDate(), -30)
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', {
    syncSteps: true,
    googleStepDays: [{ day: old, steps: 4321 }]
  })
  const res = await apiFetch<{ outcome: string }>(page, 'POST', '/api/integrations/_test/run-google-health-sync', {
    full: true
  })
  expect(res.json).toMatchObject({ outcome: 'ok' })
  const kept = await apiFetch<{ day: { steps: number } | null }>(page, 'GET', `/api/body/steps/days/${old}`)
  expect(kept.json.day).toMatchObject({ steps: 4321 })
})

test('Cancel on Google\'s consent screen lands on the card with an error, not back at consent', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const res = await page.goto('/api/integrations/google-health/connect?error=access_denied&state=x')
  expect(new URL(res!.url()).pathname + new URL(res!.url()).search).toBe('/settings/data?googleHealth=error')
  await expect(page).toHaveURL(/\/settings\/data$/)
  await expect(page.getByText('Google Health not connected', { exact: true })).toBeVisible()
})

test('deleting an account with a connection revokes the grant and removes the account', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const refreshToken = uniquePrefix('acct-del-')
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { refreshToken })
  const userId = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id

  expect((await apiFetch(page, 'DELETE', `/api/users/${userId}`)).status).toBe(200)
  const revokes = (await apiFetch<string[]>(page, 'GET', '/api/integrations/_test/google-health/revokes')).json
  expect(revokes).toContain(refreshToken)
  await goto('/settings/data', { waitUntil: 'hydration' })
  await expect(page).toHaveURL(/\/auth\/login/)
})
