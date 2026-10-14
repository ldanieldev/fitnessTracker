import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { FitNotesImportResult, FitNotesPreview } from '../../shared/types/fitnotes'
import type { WorkoutSession, WorkoutSessionSummary } from '../../shared/types/workout'
import { apiFetch, makeUser, registerViaApi } from './helpers'

const SAMPLE = readFileSync(new URL('../fixtures/fitnotes/sample.csv', import.meta.url), 'utf8')

async function runImport(page: Page, body: Record<string, unknown>) {
  const queued = await apiFetch<{ jobId: number }>(page, 'POST', '/api/workouts/import/fitnotes', body)
  expect(queued.status).toBe(201)
  const run = await apiFetch<FitNotesImportResult>(page, 'POST', '/api/workouts/_test/run-fitnotes-import', {
    jobId: queued.json.jobId
  })
  expect(run.status).toBe(200)
  return { jobId: queued.json.jobId, result: run.json }
}

async function sessionOn(page: Page, date: string): Promise<WorkoutSession> {
  const list = await apiFetch<WorkoutSessionSummary[]>(page, 'GET', `/api/workouts/sessions?from=${date}&to=${date}`)
  expect(list.json).toHaveLength(1)
  return (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${list.json[0]!.id}`)).json
}

test('FitNotes preview: counts, exact matches, suggestions, and rejects other files', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const preview = await apiFetch<FitNotesPreview>(page, 'POST', '/api/workouts/import/fitnotes/preview', {
    csv: SAMPLE
  })
  expect(preview.status).toBe(200)
  expect(preview.json).toMatchObject({
    sets: 10,
    days: 3,
    firstDate: '2026-09-28',
    lastDate: '2026-10-01',
    existingDays: 0,
    importedDays: 0
  })
  const byName = new Map(preview.json.exercises.map((e) => [e.name, e]))
  expect(byName.get('Barbell Squat')!.match).toMatchObject({ name: 'Barbell Squat', custom: false })
  expect(byName.get('Elliptical Trainer')).toMatchObject({ trackingType: 'distance_time' })
  expect(byName.get('Chin Up')).toMatchObject({ match: null, assisted: true, sets: 2 })
  expect(byName.get('Push Ups')).toMatchObject({ trackingType: 'reps' })
  expect(byName.get('Flat Barbell Bench Press')!.match).toBeNull()
  expect(byName.get('Flat Barbell Bench Press')!.suggestions.length).toBeGreaterThan(0)

  const bad = await apiFetch(page, 'POST', '/api/workouts/import/fitnotes/preview', { csv: 'Date,Workout\n1,2' })
  expect(bad.status).toBe(400)
  const headerOnly = SAMPLE.split('\n')[0]!
  expect((await apiFetch(page, 'POST', '/api/workouts/import/fitnotes/preview', { csv: headerOnly })).status).toBe(400)

  await apiFetch(page, 'DELETE', '/api/_auth/session')
  expect((await apiFetch(page, 'POST', '/api/workouts/import/fitnotes/preview', { csv: SAMPLE })).status).toBe(401)
})

test('FitNotes import: builds sessions, maps and creates exercises, keeps assists and cardio, is idempotent', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const preview = (
    await apiFetch<FitNotesPreview>(page, 'POST', '/api/workouts/import/fitnotes/preview', { csv: SAMPLE })
  ).json
  const bench = preview.exercises.find((e) => e.name === 'Flat Barbell Bench Press')!.suggestions[0]!

  expect(
    (await apiFetch(page, 'POST', '/api/workouts/import/fitnotes', { csv: SAMPLE, mapping: { Nope: null } })).status
  ).toBe(400)
  expect(
    (await apiFetch(page, 'POST', '/api/workouts/import/fitnotes', { csv: SAMPLE, mapping: { 'Chin Up': 999999 } }))
      .status
  ).toBe(404)

  const { jobId, result } = await runImport(page, { csv: SAMPLE, mapping: { 'Flat Barbell Bench Press': bench.id } })
  expect(result).toEqual({
    daysImported: 3,
    daysSkippedImported: 0,
    daysSkippedExisting: 0,
    sets: 10,
    exercisesCreated: 3,
    categoriesCreated: 1
  })
  const job = await apiFetch<{ status: string; result: FitNotesImportResult }>(
    page,
    'GET',
    `/api/workouts/import/fitnotes/${jobId}`
  )
  expect(job.json).toMatchObject({ status: 'done', result })

  const monday = await sessionOn(page, '2026-09-28')
  expect(monday.startedAt).toBe(monday.endedAt)
  expect(monday.entries.map((e) => e.exerciseName)).toEqual([bench.name, 'Elliptical Trainer'])
  expect(monday.entries[0]!.sets.map((s) => [s.weight, s.reps, s.comment])).toEqual([
    [145, 6, null],
    [150, 6, 'slight fight, last rep']
  ])
  expect(monday.entries[1]).toMatchObject({ trackingType: 'distance_time' })
  expect(monday.entries[1]!.sets[0]).toMatchObject({ distanceMeters: 2011.68, durationSeconds: 1200 })

  const tuesday = await sessionOn(page, '2026-09-29')
  expect(tuesday.entries.map((e) => e.exerciseName)).toEqual(['Chin Up', 'Barbell Squat', 'Tall Clean Drill'])
  expect(tuesday.entries[0]).toMatchObject({ loadStyle: 'assisted', trackingType: 'weight_reps' })
  expect(tuesday.entries[0]!.sets.map((s) => s.weight)).toEqual([85, 85])
  expect(tuesday.entries[1]!.loadStyle).toBe('barbell')
  expect(tuesday.entries[2]!.sets[0]).toMatchObject({ weight: 132.28, reps: 3 })

  const wednesday = await sessionOn(page, '2026-10-01')
  expect(wednesday.entries[0]).toMatchObject({ exerciseName: 'Push Ups', trackingType: 'reps' })
  expect(wednesday.entries[0]!.sets[0]).toMatchObject({ weight: null, reps: 15 })

  const categories = await apiFetch<Array<{ name: string; shared: boolean }>>(page, 'GET', '/api/workouts/categories')
  expect(categories.json.some((c) => c.name === 'Olympic' && !c.shared)).toBe(true)

  const again = await runImport(page, { csv: SAMPLE, mapping: { 'Flat Barbell Bench Press': bench.id } })
  expect(again.result).toMatchObject({ daysImported: 0, daysSkippedImported: 3, exercisesCreated: 0, sets: 0 })
  const repreview = await apiFetch<FitNotesPreview>(page, 'POST', '/api/workouts/import/fitnotes/preview', {
    csv: SAMPLE
  })
  expect(repreview.json).toMatchObject({ importedDays: 3, existingDays: 0 })
  expect(repreview.json.exercises.find((e) => e.name === 'Chin Up')!.match).toMatchObject({ custom: true })
})

test('FitNotes import: skips days that already have a workout unless told not to', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const started = await apiFetch(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-10-01' })
  expect(started.ok).toBe(true)

  const preview = await apiFetch<FitNotesPreview>(page, 'POST', '/api/workouts/import/fitnotes/preview', {
    csv: SAMPLE
  })
  expect(preview.json.existingDays).toBe(1)
  const skipped = await runImport(page, { csv: SAMPLE })
  expect(skipped.result).toMatchObject({ daysImported: 2, daysSkippedExisting: 1 })

  const forced = await runImport(page, { csv: SAMPLE, skipExistingDays: false })
  expect(forced.result).toMatchObject({ daysImported: 1, daysSkippedImported: 2, daysSkippedExisting: 0 })
})

test('FitNotes import: the settings card previews, remaps from a suggestion and imports', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/workout', { waitUntil: 'hydration' })

  await page.locator('input[data-test="fitnotes-file"]').setInputFiles({
    name: 'FitNotes_Export.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(SAMPLE)
  })
  await expect(page.locator('[data-test="fitnotes-summary"]')).toContainText('10 sets on 3 days')
  await expect(page.locator('[data-test="fitnotes-target-Barbell Squat"]')).toHaveText('Barbell Squat')
  await expect(page.locator('[data-test="fitnotes-target-Chin Up"]')).toHaveText('New exercise')

  const row = page.locator('[data-test="fitnotes-row-Flat Barbell Bench Press"]')
  const suggestion = row.locator('[data-test^="fitnotes-suggest-Flat Barbell Bench Press-"]').first()
  const suggested = (await suggestion.textContent())!.trim()
  await suggestion.click()
  await expect(page.locator('[data-test="fitnotes-target-Flat Barbell Bench Press"]')).toHaveText(suggested)

  await page.locator('[data-test="fitnotes-only-new"]').click()
  await expect(page.locator('[data-test="fitnotes-row-Barbell Squat"]')).toHaveCount(0)
  await expect(page.locator('[data-test="fitnotes-row-Chin Up"]')).toBeVisible()

  const queued = page.waitForResponse((r) => r.url().endsWith('/api/workouts/import/fitnotes') && r.status() === 201)
  await page.locator('[data-test="fitnotes-submit"]').click()
  const { jobId } = (await (await queued).json()) as { jobId: number }
  await apiFetch(page, 'POST', '/api/workouts/_test/run-fitnotes-import', { jobId })
  await expect(page.locator('[data-test="fitnotes-result"]')).toContainText('3 days and 10 sets imported')

  const monday = await sessionOn(page, '2026-09-28')
  expect(monday.entries[0]!.exerciseName).toBe(suggested)
})
