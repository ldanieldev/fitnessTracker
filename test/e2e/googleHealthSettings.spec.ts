import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { MeasurementType } from '../../shared/types/body'
import type { GoogleHealthStatus } from '../../shared/types/googleHealth'
import { GOOGLE_HEALTH_SCOPES } from '../../server/utils/googleHealth/scopes'

test('not connected: the card offers Connect', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await expect(card.getByRole('link', { name: 'Connect Google Health' })).toHaveAttribute(
    'href',
    '/api/integrations/google-health/connect'
  )
})

test('connected: sync now toasts counts, toggles save, synced entries show the badge, disconnect asks first', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', {})
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await expect(card.locator('[data-test="google-health-email"]')).toHaveText(/^stub-\d+@example\.com$/)

  await card.getByRole('button', { name: 'Sync now' }).click()
  await expect(page.getByText('Synced: 3 HRV, 3 resting HR, 3 sleep', { exact: true })).toBeVisible()

  await card.getByRole('switch', { name: 'Import steps from Google' }).click()
  await expect
    .poll(async () => {
      const res = await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')
      return res.json.connection?.syncSteps
    })
    .toBe(true)

  const hrv = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'hrv')!
  await goto(`/body/${hrv.id}`, { waitUntil: 'hydration' })
  await page.locator('[data-test="range-tabs"]').getByRole('tab', { name: 'All' }).click()
  await expect(page.locator('[data-test^="entry-row-"]').first()).toContainText('Google')

  await goto('/settings/data', { waitUntil: 'hydration' })
  await card.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('button', { name: 'Disconnect', exact: true }).last().click()
  await expect(card.getByRole('link', { name: 'Connect Google Health' })).toBeVisible()
})

test('reconnect needed: a warning and a Reconnect link', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { status: 'reconnect_required' })
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await expect(card.getByRole('link', { name: 'Reconnect' })).toBeVisible()
})

test('a scope not granted says so', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { scopes: ['openid', 'email'] })
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await expect(card.getByText('Sleep not allowed. Reconnect to grant it.')).toBeVisible()
  await expect(card.getByText('HRV and resting HR not allowed. Reconnect to grant it.')).toBeVisible()
  await expect(card.getByText('Not allowed. Reconnect to grant it.', { exact: true })).toHaveCount(2)
  await expect(card.getByRole('link', { name: 'Reconnect' })).toHaveAttribute(
    'href',
    '/api/integrations/google-health/connect'
  )
})

test('only the weigh-in scope missing still offers Reconnect', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const scopes = GOOGLE_HEALTH_SCOPES.filter((s) => !s.endsWith('.writeonly'))
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { scopes })
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await expect(card.getByRole('link', { name: 'Reconnect' })).toBeVisible()
  await expect(card.getByText(/not allowed\. Reconnect/)).toHaveCount(0)
  await expect(card.getByText('Not allowed. Reconnect to grant it.', { exact: true })).toHaveCount(1)
})

test('Disconnect then Cancel keeps the connection', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', {})
  await goto('/settings/data', { waitUntil: 'hydration' })
  const card = page.locator('[data-test="google-health"]')
  await card.getByRole('button', { name: 'Disconnect' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Sync now' })).toBeVisible()
  const status = await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')
  expect(status.json.connection).not.toBeNull()
})

test('a last error shows on the card', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', {})
  await apiFetch(page, 'POST', '/api/integrations/_test/google-health/fail-next', {
    dataType: 'sleep',
    status: 400
  })
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')
  await goto('/settings/data', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="google-health-error"]')).toContainText('Sleep: ')
})

test('?googleHealth=connected toasts and is cleaned from the URL', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/data?googleHealth=connected', { waitUntil: 'hydration' })
  await expect(page.getByText('Google Health connected', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/settings\/data$/)
})
