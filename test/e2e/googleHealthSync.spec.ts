import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { MeasurementEntry, MeasurementType } from '../../shared/types/body'
import type { GoogleHealthStatus, SyncResult } from '../../shared/types/googleHealth'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'

async function connectedUser(page: Page, seed: Record<string, unknown> = {}) {
  await registerViaApi(page, makeUser())
  const res = await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', seed)
  expect(res.status).toBe(200)
}

async function typeId(page: Page, key: string) {
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  return types.find((t) => t.key === key)!.id
}

const entries = async (page: Page, key: string) =>
  (await apiFetch<MeasurementEntry[]>(page, 'GET', `/api/body/types/${await typeId(page, key)}/entries`)).json

const STUB = '/api/integrations/_test/google-health'

// The stub's days are relative to the server's date; e2e and server share a clock here.
const serverDay = (n: number) => shiftDate(todayDate(), -n)

test('status: available and not connected for a new user', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const res = await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')
  expect(res.json).toEqual({ available: true, connection: null })
  expect((await apiFetch(page, 'POST', '/api/integrations/google-health/sync')).status).toBe(404)
})

test('sync now lands HRV, resting HR (WITH_SLEEP only), sleep hours and sessions; steps stay off', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await connectedUser(page)
  const res = await apiFetch<SyncResult>(page, 'POST', '/api/integrations/google-health/sync')
  expect(res.json).toEqual({ outcome: 'ok', counts: { hrv: 3, restingHr: 3, sleep: 3, steps: 0 }, errors: [] })

  const hrv = await entries(page, 'hrv')
  expect(hrv.map((e) => [e.measuredOn, e.value, e.source])).toEqual([
    [serverDay(1), 60, 'google'],
    [serverDay(2), 61, 'google'],
    [serverDay(3), 62, 'google']
  ])
  expect((await entries(page, 'resting_hr')).map((e) => e.measuredOn)).not.toContain(serverDay(4))
  expect((await entries(page, 'sleep')).find((e) => e.measuredOn === serverDay(1))!.value).toBe(7)

  const again = await apiFetch<SyncResult>(page, 'POST', '/api/integrations/google-health/sync')
  expect(again.json).toMatchObject({ outcome: 'ok' })
  expect(await entries(page, 'hrv')).toHaveLength(3)

  const status = (await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')).json
  expect(status.connection).toMatchObject({ status: 'active', lastError: null })
  expect(status.connection!.lastSyncedAt).not.toBeNull()
})

test('manual wins: a manual entry replaces the synced row on the next sync and is never overwritten', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await connectedUser(page)
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')
  const id = await typeId(page, 'hrv')
  await apiFetch(page, 'POST', '/api/body/entries', { typeId: id, value: 99, measuredOn: serverDay(1) })
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')
  const day1 = (await entries(page, 'hrv')).filter((e) => e.measuredOn === serverDay(1))
  expect(day1.map((e) => [e.value, e.source])).toEqual([[99, 'manual']])
})

test('without a main-sleep end, a re-pull keeps the HRV reading time it first got', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const metricsOnly = [
    'openid',
    'email',
    'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly'
  ]
  await connectedUser(page, { scopes: metricsOnly })
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')
  const first = (await entries(page, 'hrv')).map((e) => [e.measuredOn, e.measuredAt])
  expect(first).toHaveLength(3)
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')
  expect((await entries(page, 'hrv')).map((e) => [e.measuredOn, e.measuredAt])).toEqual(first)
})

test('steps sync only when the user opted in', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await connectedUser(page, { syncSteps: true })
  const res = await apiFetch<SyncResult>(page, 'POST', '/api/integrations/google-health/sync')
  expect(res.json).toMatchObject({ outcome: 'ok', counts: { steps: 3 } })
  const day = await apiFetch<{ day: { steps: number } | null }>(page, 'GET', `/api/body/steps/days/${serverDay(1)}`)
  expect(day.json.day!.steps).toBe(8000)
})

test('a revoked grant flips the connection to reconnect and does not throw', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await connectedUser(page, { refreshToken: 'revoked' })
  const res = await apiFetch<SyncResult>(page, 'POST', '/api/integrations/google-health/sync')
  expect(res.json).toEqual({ outcome: 'reconnect_required' })
  const status = (await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')).json
  expect(status.connection!.status).toBe('reconnect_required')
})

test('two Sync now calls at once: one runs, the other gets 409, no duplicates', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await connectedUser(page)
  await apiFetch(page, 'POST', `${STUB}/hold-token`)
  try {
    const first = apiFetch(page, 'POST', '/api/integrations/google-health/sync')
    await expect
      .poll(async () => (await apiFetch<{ waiting: boolean }>(page, 'GET', `${STUB}/token-held`)).json.waiting)
      .toBe(true)
    expect((await apiFetch(page, 'POST', '/api/integrations/google-health/sync')).status).toBe(409)
    await apiFetch(page, 'POST', `${STUB}/release-token`)
    expect((await first).status).toBe(200)
  } finally {
    await apiFetch(page, 'POST', `${STUB}/release-token`)
  }
  expect(await entries(page, 'hrv')).toHaveLength(3)
})

test('a 5xx on a data call: Sync now reports it, the scheduled job throws so Inngest retries', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await connectedUser(page)
  await apiFetch(page, 'POST', `${STUB}/fail-next`, { dataType: 'daily-heart-rate-variability', status: 503, times: 2 })
  const now = await apiFetch<SyncResult>(page, 'POST', '/api/integrations/google-health/sync')
  expect(now.status).toBe(200)
  expect(now.json).toMatchObject({ outcome: 'ok', counts: { hrv: 0, restingHr: 3 } })
  expect(now.json).not.toHaveProperty('retryable')
  expect((now.json as { errors: string[] }).errors).toEqual([expect.stringMatching(/^HRV: .*503/)])

  await apiFetch(page, 'POST', `${STUB}/fail-next`, { dataType: 'daily-heart-rate-variability', status: 503, times: 2 })
  expect((await apiFetch(page, 'POST', '/api/integrations/_test/run-google-health-sync', {})).status).toBe(500)
  const status = (await apiFetch<GoogleHealthStatus>(page, 'GET', '/api/integrations/google-health')).json
  expect(status.connection!.lastError).toMatch(/^HRV: /)

  await apiFetch(page, 'POST', `${STUB}/fail-next`, { dataType: 'daily-heart-rate-variability', status: 400 })
  const permanent = await apiFetch(page, 'POST', '/api/integrations/_test/run-google-health-sync', {})
  expect(permanent.status).toBe(200)
  expect(permanent.json).toMatchObject({ outcome: 'ok', retryable: false })
})
