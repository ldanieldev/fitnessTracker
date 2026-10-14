import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

test('day notes API: upsert, trim, blank deletes, list newest first, per user', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  expect((await apiFetch(page, 'GET', '/api/days/2026-10-04/note')).json).toEqual({ date: '2026-10-04', note: null })
  const saved = await apiFetch(page, 'PUT', '/api/days/2026-10-04/note', { note: '  event day  ' })
  expect(saved.json).toEqual({ date: '2026-10-04', note: 'event day' })
  await apiFetch(page, 'PUT', '/api/days/2026-10-04/note', { note: 'event day, ate out' })
  await apiFetch(page, 'PUT', '/api/days/2026-10-05/note', { note: 'logging error' })
  await apiFetch(page, 'PUT', '/api/days/2026-09-30/note', { note: 'headache' })

  const all = await apiFetch<Array<{ date: string; note: string }>>(page, 'GET', '/api/days/notes')
  expect(all.json).toEqual([
    { date: '2026-10-05', note: 'logging error' },
    { date: '2026-10-04', note: 'event day, ate out' },
    { date: '2026-09-30', note: 'headache' }
  ])
  const ranged = await apiFetch<Array<{ date: string }>>(page, 'GET', '/api/days/notes?from=2026-10-01&to=2026-10-04')
  expect(ranged.json.map((n) => n.date)).toEqual(['2026-10-04'])
  const limited = await apiFetch<Array<{ date: string }>>(page, 'GET', '/api/days/notes?limit=1')
  expect(limited.json.map((n) => n.date)).toEqual(['2026-10-05'])

  expect((await apiFetch(page, 'PUT', '/api/days/2026-10-05/note', { note: '   ' })).json).toEqual({
    date: '2026-10-05',
    note: null
  })
  expect((await apiFetch(page, 'GET', '/api/days/2026-10-05/note')).json).toEqual({ date: '2026-10-05', note: null })

  expect((await apiFetch(page, 'PUT', '/api/days/2026-02-30/note', { note: 'x' })).status).toBe(400)
  expect((await apiFetch(page, 'PUT', '/api/days/2026-10-06/note', { note: 'x'.repeat(5001) })).status).toBe(400)
  expect((await apiFetch(page, 'PUT', '/api/days/2026-10-06/note', {})).status).toBe(400)
  expect((await apiFetch(page, 'GET', '/api/days/notes?limit=0')).status).toBe(400)

  await apiFetch(page, 'DELETE', '/api/_auth/session')
  expect((await apiFetch(page, 'GET', '/api/days/notes')).status).toBe(401)
  await registerViaApi(page, makeUser())
  expect((await apiFetch(page, 'GET', '/api/days/notes')).json).toEqual([])
  expect((await apiFetch(page, 'GET', '/api/days/2026-10-04/note')).json).toEqual({ date: '2026-10-04', note: null })
})

test('day notes: the diary day reads the shared note', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await apiFetch(page, 'PUT', '/api/days/2026-09-04/note', { note: 'Refeed day' })
  const day = await apiFetch<{ notes: string | null; persisted: boolean }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-09-04'
  )
  expect(day.json.notes).toBe('Refeed day')
  expect(day.json.persisted).toBe(false)
})

test('day notes page: write one for a chosen day, then edit it from the list', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/notes', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="notes-empty"]')).toBeVisible()

  await page.locator('[data-test="notes-date"]').fill('2026-10-10')
  await page.locator('[data-test="notes-write"]').click()
  await page.locator('[data-test="day-notes-input"]').fill('Skipped legs, felt strained')
  await page.locator('[data-test="day-notes-save"]').click()
  await expect(page.locator('[data-test="note-2026-10-10"]')).toContainText('Sat, Oct 10, 2026')
  await expect(page.locator('[data-test="note-2026-10-10"]')).toContainText('Skipped legs, felt strained')

  await page.locator('[data-test="note-2026-10-10"]').click()
  await expect(page.locator('[data-test="day-notes-input"]')).toHaveValue('Skipped legs, felt strained')
  await page.locator('[data-test="day-notes-input"]').fill('Skipped legs')
  await page.locator('[data-test="day-notes-save"]').click()
  await expect(page.locator('[data-test="note-2026-10-10"]')).toContainText('Skipped legs')
  await expect(page.locator('[data-test="note-2026-10-10"]')).not.toContainText('strained')
})

test('day notes: the dashboard Today strip adds today’s note', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="today-note-text"]')).toHaveText('Nothing noted today')
  await page.locator('[data-test="today-note-edit"]').click()
  await page.locator('[data-test="day-notes-input"]').fill('Poor sleep')
  await page.locator('[data-test="day-notes-save"]').click()
  await expect(page.locator('[data-test="today-note-text"]')).toHaveText('Poor sleep')
})
