import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { ImportResult } from '../../shared/types/nutrition'
import { apiFetch, makeUser, registerViaApi, uploadFiles } from './helpers'

// The upload-route tests below need the compose `inngest` service running — queueImportJob fails and the route 503s otherwise.

interface DayEntry {
  description: string | null
  unitLabel: string
  quantity: string | number
}

interface DayView {
  containers: Array<{ name: string, entries: DayEntry[] }>
  entries: DayEntry[]
  totals: Record<string, number>
}

test('imports two export files, is idempotent, and lands the entries in the diary', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const files = ['2026-09-04.txt', '2026-09-05.txt'].map((name) => ({
    name,
    text: readFileSync(new URL(`../fixtures/mymacros/${name}`, import.meta.url), 'utf8')
  }))

  const job = await apiFetch<{ jobId: number }>(page, 'POST', '/api/nutrition/_test/import-job', { files })
  const first = await apiFetch<ImportResult>(page, 'POST', '/api/nutrition/_test/run-import', { jobId: job.json.jobId })
  expect(first.status).toBe(200)
  expect(first.json).toMatchObject({ days: 2, entries: 29, entriesSkipped: 0, failedFiles: [] })
  expect(first.json.foodsCreated).toBeGreaterThan(10)
  expect(first.json.containersCreated).toBe(0) // registration already seeded Meal 1-5 + Snack

  const again = await apiFetch<{ jobId: number }>(page, 'POST', '/api/nutrition/_test/import-job', { files })
  const second = await apiFetch<ImportResult>(page, 'POST', '/api/nutrition/_test/run-import', { jobId: again.json.jobId })
  expect(second.json).toMatchObject({ entries: 0, entriesSkipped: 29, foodsCreated: 0 })

  const day = await apiFetch<DayView>(page, 'GET', '/api/nutrition/diary/2026-09-05')
  expect(day.status).toBe(200)
  expect(day.json.entries).toHaveLength(18)
  expect(Number(day.json.totals.energy)).toBeCloseTo(1886.09, 1)

  const silkEntry = day.json.entries.find((e) => e.unitLabel === 'fl oz')!
  expect(silkEntry.description).toBe('Silk Vanilla Almond Milk')
  expect(day.json.entries.every((e) => e.description !== null && e.description !== '')).toBe(true)
})

interface ImportJobView {
  id: number
  status: string
  fileCount: number
  result: ImportResult | null
  error: string | null
  createdAt: string
}

test('upload route queues a job and the status route reports its progress', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const files = ['2026-09-04.txt', '2026-09-05.txt'].map((name) => ({
    name,
    text: readFileSync(new URL(`../fixtures/mymacros/${name}`, import.meta.url), 'utf8')
  }))

  const upload = await uploadFiles(page, '/api/nutrition/import/mymacros', files)
  expect(upload.status).toBe(201)
  const jobId = (upload.json as { jobId: number }).jobId
  expect(jobId).toBeGreaterThan(0)

  const queued = await apiFetch<ImportJobView>(page, 'GET', `/api/nutrition/import/mymacros/${jobId}`)
  expect(queued.status).toBe(200)
  expect(queued.json.status).toBe('queued')
  expect(queued.json.fileCount).toBe(2)

  const run = await apiFetch(page, 'POST', '/api/nutrition/_test/run-import', { jobId })
  expect(run.status).toBe(200)

  const done = await apiFetch<ImportJobView>(page, 'GET', `/api/nutrition/import/mymacros/${jobId}`)
  expect(done.json.status).toBe('done')
  expect(done.json.result?.entries).toBe(29)
})

test('upload route rejects an empty submission', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const empty = await uploadFiles(page, '/api/nutrition/import/mymacros', [])
  expect(empty.status).toBe(400)
})

test('upload route rejects a file whose first line is not a My Macros+ header', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bad = await uploadFiles(page, '/api/nutrition/import/mymacros', [{ name: 'not-an-export.txt', text: 'not a header\nmore text\n' }])
  expect(bad.status).toBe(400)
  expect((bad.json as { data: { fileName: string } }).data.fileName).toBe('not-an-export.txt')
})

test('status route 404s on another users job', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const files = [{ name: '2026-09-04.txt', text: readFileSync(new URL('../fixtures/mymacros/2026-09-04.txt', import.meta.url), 'utf8') }]
  const upload = await uploadFiles(page, '/api/nutrition/import/mymacros', files)
  const jobId = (upload.json as { jobId: number }).jobId

  await registerViaApi(page, makeUser())
  const stolen = await apiFetch(page, 'GET', `/api/nutrition/import/mymacros/${jobId}`)
  expect(stolen.status).toBe(404)
})

test('status route 404s on a non-numeric job id', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const res = await apiFetch(page, 'GET', '/api/nutrition/import/mymacros/abc')
  expect(res.status).toBe(404)
})

test('upload route accepts a .txt file sent with a generic content type', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const files = [{
    name: '2026-09-04.txt',
    text: readFileSync(new URL('../fixtures/mymacros/2026-09-04.txt', import.meta.url), 'utf8'),
    type: 'application/octet-stream'
  }]
  const upload = await uploadFiles(page, '/api/nutrition/import/mymacros', files)
  expect(upload.status).toBe(201)
})

test('the settings UI uploads files, polls the job, and shows the summary', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await goto('/settings/nutrition', { waitUntil: 'hydration' })

  const fixturePaths = ['2026-09-04.txt', '2026-09-05.txt'].map((name) =>
    fileURLToPath(new URL(`../fixtures/mymacros/${name}`, import.meta.url))
  )
  await page.locator('[data-test="import-files"]').setInputFiles(fixturePaths)

  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/nutrition/import/mymacros') && r.request().method() === 'POST'),
    page.locator('[data-test="import-submit"]').click()
  ])
  expect(uploadResponse.ok()).toBe(true)
  const { jobId } = (await uploadResponse.json()) as { jobId: number }

  const run = await apiFetch(page, 'POST', '/api/nutrition/_test/run-import', { jobId })
  expect(run.status).toBe(200)

  await expect(page.locator('[data-test="import-status"]')).toHaveText(/done/, { timeout: 10000 })
  await expect(page.locator('[data-test="import-summary"]')).toContainText(/29 entries|29 skipped/)
})
