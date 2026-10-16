import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { MeasurementEntry, MeasurementType } from '../../shared/types/body'
import { todayDate } from '../../shared/utils/nutritionSummary'

interface StubWeight {
  name: string
  weight: { sampleTime: { physicalTime: string; utcOffset: string }; weightGrams: number }
}

const writes = async (page: Page) =>
  (await apiFetch<StubWeight[]>(page, 'GET', '/api/integrations/_test/google-health/writes')).json

async function setup(page: Page, pushWeight = true) {
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'DELETE', '/api/integrations/_test/google-health/writes')
  await apiFetch(page, 'POST', '/api/integrations/_test/seed-google-health', { pushWeight })
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  return types.find((t) => t.key === 'bodyweight')!.id
}

interface WeightEvent {
  name: string
  data: {
    userId: number
    measurementId: number
    utcOffsetMinutes: number | null
    previousExternalId: string | null
    deleted: boolean
  }
}

async function weightEvents(userId: number, measurementId?: number) {
  const stub = process.env.INNGEST_EVENT_API_BASE_URL
  expect(stub, 'e2e must queue into the Inngest stub, not the dev Inngest').toBeTruthy()
  const sent = (await (await fetch(new URL('sent', stub))).json()) as WeightEvent[]
  return sent.filter(
    (e) =>
      e.name === 'google-health/weight.changed' &&
      e.data.userId === userId &&
      (measurementId === undefined || e.data.measurementId === measurementId)
  )
}

const sessionUserId = async (page: Page) =>
  (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id

const runPush = (page: Page, body: Record<string, unknown>) =>
  apiFetch<{ result: string }>(page, 'POST', '/api/integrations/_test/run-weight-push', body)

test('a weigh-in is created in Google with grams and offset, then edited and deleted', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15',
    utcOffsetMinutes: -300
  })
  expect((await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })).json.result).toBe('pushed')
  expect((await writes(page)).map((w) => [w.weight.weightGrams, w.weight.sampleTime])).toEqual([
    [99564, { physicalTime: '2026-10-15T12:35:00.000Z', utcOffset: '-18000s' }]
  ])

  await apiFetch(page, 'PATCH', `/api/body/entries/${created.json.id}`, { value: 220.2, utcOffsetMinutes: -300 })
  const firstName = (await writes(page))[0]!.name
  await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300, previousExternalId: firstName })
  expect((await writes(page)).map((w) => w.weight.weightGrams)).toEqual([99881])

  const secondName = (await writes(page))[0]!.name
  await apiFetch(page, 'DELETE', `/api/body/entries/${created.json.id}`)
  await runPush(page, { measurementId: created.json.id, previousExternalId: secondName, deleted: true })
  expect(await writes(page)).toEqual([])
})

test('an edit without an offset leaves Google and the stored id untouched', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15'
  })
  await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })
  const name = (await writes(page))[0]!.name
  await apiFetch(page, 'PATCH', `/api/body/entries/${created.json.id}`, { value: 220.2 })
  const result = await runPush(page, {
    measurementId: created.json.id,
    utcOffsetMinutes: null,
    previousExternalId: name
  })
  expect(result.json.result).toBe('skipped')
  expect((await writes(page)).map((w) => w.name)).toEqual([name])
})

test('a previous point that is already gone does not block the new one', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15'
  })
  const result = await runPush(page, {
    measurementId: created.json.id,
    utcOffsetMinutes: -300,
    previousExternalId: 'users/me/dataTypes/weight/dataPoints/gone'
  })
  expect(result.json.result).toBe('pushed')
  expect(await writes(page)).toHaveLength(1)
})

test('a retried push adopts our existing point instead of creating a duplicate', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15'
  })
  await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })
  await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })
  expect(await writes(page)).toHaveLength(1)
})

test('no offset (token save): nothing is sent and the card gets the reason', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredOn: todayDate()
  })
  expect((await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: null })).json.result).toBe('skipped')
  expect(await writes(page)).toEqual([])
  const status = await apiFetch<{ connection: { lastError: string } }>(page, 'GET', '/api/integrations/google-health')
  expect(status.json.connection.lastError).toBe(`Weigh-in on ${todayDate()} not sent to Google: no timezone offset`)
})

test('push off, or a non-weight type: nothing is sent', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page, false)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', { typeId, value: 219.5 })
  expect((await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })).json.result).toBe('skipped')
  expect(await writes(page)).toEqual([])
})

test('editing a synced entry turns it manual', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await setup(page)
  await apiFetch(page, 'POST', '/api/integrations/google-health/sync')
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  const hrvId = types.find((t) => t.key === 'hrv')!.id
  const [entry] = (await apiFetch<MeasurementEntry[]>(page, 'GET', `/api/body/types/${hrvId}/entries`)).json
  const edited = await apiFetch<MeasurementEntry>(page, 'PATCH', `/api/body/entries/${entry!.id}`, { value: 50 })
  expect(edited.json.source).toBe('manual')
})

test('saving, editing and deleting a weigh-in with push on queues the push event', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const userId = await sessionUserId(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15',
    utcOffsetMinutes: -300
  })
  const id = created.json.id
  expect((await weightEvents(userId, id)).map((e) => e.data)).toEqual([
    { userId, measurementId: id, utcOffsetMinutes: -300, previousExternalId: null, deleted: false }
  ])

  await runPush(page, { measurementId: id, utcOffsetMinutes: -300 })
  const name = (await writes(page))[0]!.name
  await apiFetch(page, 'PATCH', `/api/body/entries/${id}`, { value: 220.2, utcOffsetMinutes: -300 })
  expect((await weightEvents(userId, id))[1]!.data).toEqual({
    userId,
    measurementId: id,
    utcOffsetMinutes: -300,
    previousExternalId: name,
    deleted: false
  })

  await apiFetch(page, 'DELETE', `/api/body/entries/${id}`)
  expect((await weightEvents(userId, id))[2]!.data).toEqual({
    userId,
    measurementId: id,
    utcOffsetMinutes: null,
    previousExternalId: name,
    deleted: true
  })
  expect(await weightEvents(userId, id)).toHaveLength(3)
})

test('push off, or a non-weight type: nothing is queued', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page, false)
  const userId = await sessionUserId(page)
  await apiFetch(page, 'POST', '/api/body/entries', { typeId, value: 219.5, utcOffsetMinutes: -300 })

  await apiFetch(page, 'PATCH', '/api/integrations/google-health', { pushWeight: true })
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  const waist = types.find((t) => t.key === 'waist')!.id
  await apiFetch(page, 'POST', '/api/body/entries', { typeId: waist, value: 34, utcOffsetMinutes: -300 })
  expect(await weightEvents(userId)).toEqual([])
})

test('a weigh-in saved through the Body sheet sends the browser\'s offset', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const userId = await sessionUserId(page)
  await goto('/body', { waitUntil: 'hydration' })
  await page.locator(`[data-test="metric-log-${typeId}"]`).click()
  await page.locator('input[data-test="entry-value"]').fill('198.8')
  await page.locator('[data-test="entry-save"]').click()
  await expect(page.locator(`[data-test="metric-latest-${typeId}"]`)).toHaveText('198.8')
  const [event] = await weightEvents(userId)
  expect(typeof event!.data.utcOffsetMinutes).toBe('number')
})

test('our point at that time with other grams is replaced, not adopted', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15'
  })
  await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })
  await apiFetch(page, 'PATCH', `/api/body/entries/${created.json.id}`, { value: 220.2 })
  expect((await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })).json.result).toBe('pushed')
  expect((await writes(page)).map((w) => w.weight.weightGrams)).toEqual([99881])
})

test('a stale point deleted before a failed create is no longer the stored id', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const typeId = await setup(page)
  const userId = await sessionUserId(page)
  const created = await apiFetch<MeasurementEntry>(page, 'POST', '/api/body/entries', {
    typeId,
    value: 219.5,
    measuredAt: '2026-10-15T12:35:00.000Z',
    measuredOn: '2026-10-15'
  })
  await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })
  await apiFetch(page, 'PATCH', `/api/body/entries/${created.json.id}`, { value: 220.2 })
  await apiFetch(page, 'POST', '/api/integrations/_test/google-health/fail-next', {
    dataType: 'weight',
    status: 500,
    call: 'POST'
  })
  expect((await runPush(page, { measurementId: created.json.id, utcOffsetMinutes: -300 })).status).toBe(500)
  expect(await writes(page)).toEqual([])
  await apiFetch(page, 'PATCH', `/api/body/entries/${created.json.id}`, { value: 220.4 })
  expect((await weightEvents(userId, created.json.id)).at(-1)!.data.previousExternalId).toBeNull()
})
