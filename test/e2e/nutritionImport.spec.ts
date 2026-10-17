import { readFileSync } from 'node:fs'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { ImportResult } from '../../shared/types/nutrition'
import { apiFetch, makeUser, registerViaApi, uploadFiles } from './helpers'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/mymacros/${name}`, import.meta.url), 'utf8')

interface DayEntry {
  description: string | null
  unitLabel: string
  quantity: string | number
}

interface DayView {
  containers: Array<{ name: string; entries: DayEntry[] }>
  entries: DayEntry[]
  totals: Record<string, number>
}

test('imports two export files, is idempotent, and lands the entries in the diary', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const files = ['2026-09-04.txt', '2026-09-05.txt'].map((name) => ({ name, text: fixture(name) }))

  const job = await apiFetch<{ jobId: number }>(page, 'POST', '/api/nutrition/_test/import-job', { files })
  const first = await apiFetch<ImportResult>(page, 'POST', '/api/nutrition/_test/run-import', { jobId: job.json.jobId })
  expect(first.status).toBe(200)
  expect(first.json).toMatchObject({ days: 2, entries: 29, entriesSkipped: 0, failedFiles: [] })
  expect(first.json.foodsCreated).toBeGreaterThan(10)
  expect(first.json.containersCreated).toBe(0) // registration already seeded Meal 1-5 + Snack

  const again = await apiFetch<{ jobId: number }>(page, 'POST', '/api/nutrition/_test/import-job', { files })
  const second = await apiFetch<ImportResult>(page, 'POST', '/api/nutrition/_test/run-import', {
    jobId: again.json.jobId
  })
  expect(second.json).toMatchObject({ entries: 0, entriesSkipped: 29, foodsCreated: 0 })

  const day = await apiFetch<DayView>(page, 'GET', '/api/nutrition/diary/2026-09-05')
  expect(day.status).toBe(200)
  expect(day.json.entries).toHaveLength(18)
  expect(Number(day.json.totals.energy)).toBeCloseTo(1886.09, 1)

  const silkEntry = day.json.entries.find((e) => e.unitLabel === 'fl oz')!
  expect(silkEntry.description).toBe('Silk Vanilla Almond Milk')
  expect(day.json.entries.every((e) => e.description !== null && e.description !== '')).toBe(true)
})

test('two imports of the same files racing each other insert every entry exactly once', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const files = ['2026-09-04.txt', '2026-09-05.txt'].map((name) => ({ name, text: fixture(name) }))

  const jobs = await Promise.all(
    [0, 1].map(() => apiFetch<{ jobId: number }>(page, 'POST', '/api/nutrition/_test/import-job', { files }))
  )
  const run = (jobId: number) => apiFetch<ImportResult>(page, 'POST', '/api/nutrition/_test/run-import', { jobId })
  const runs = await Promise.all(jobs.map(({ json }) => run(json.jobId)))
  expect(runs.map((r) => r.status)).toEqual([200, 200])
  expect(runs[0]!.json.entries + runs[1]!.json.entries).toBe(29)
  expect(runs[0]!.json.entriesSkipped + runs[1]!.json.entriesSkipped).toBe(29)

  const day = await apiFetch<DayView>(page, 'GET', '/api/nutrition/diary/2026-09-05')
  expect(day.json.entries).toHaveLength(18)
})

test('an imported food can be forked more than once', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const files = [{ name: '2026-09-05.txt', text: fixture('2026-09-05.txt') }]
  const job = await apiFetch<{ jobId: number }>(page, 'POST', '/api/nutrition/_test/import-job', { files })
  await apiFetch(page, 'POST', '/api/nutrition/_test/run-import', { jobId: job.json.jobId })

  const day = await apiFetch<{ entries: Array<{ foodId: number | null }> }>(
    page,
    'GET',
    '/api/nutrition/diary/2026-09-05'
  )
  const foodId = day.json.entries.find((e) => e.foodId !== null)!.foodId!
  const first = await apiFetch<{ id: number }>(page, 'POST', `/api/nutrition/foods/${foodId}/fork`)
  const second = await apiFetch<{ id: number }>(page, 'POST', `/api/nutrition/foods/${foodId}/fork`)
  expect([first.status, second.status]).toEqual([200, 200])
  expect(first.json.id).not.toBe(second.json.id)
})

interface ImportJobView {
  id: number
  status: string
  fileCount: number
  result: ImportResult | null
  error: string | null
  createdAt: string
}

test('upload route queues a job, accepts a generic content type, and the status route reports its progress', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const files = [
    { name: '2026-09-04.txt', text: fixture('2026-09-04.txt') },
    { name: '2026-09-05.txt', text: fixture('2026-09-05.txt'), type: 'application/octet-stream' }
  ]

  const upload = await uploadFiles(page, '/api/nutrition/import/mymacros', files)
  expect(upload.status).toBe(201)
  const jobId = (upload.json as { jobId: number }).jobId
  expect(jobId).toBeGreaterThan(0)
  const stub = process.env.INNGEST_EVENT_API_BASE_URL
  expect(stub, 'e2e must queue into the Inngest stub, not the dev Inngest').toBeTruthy()
  const sent = (await (await fetch(new URL('sent', stub))).json()) as Array<{ data: { jobId: number } }>
  expect(sent.some((event) => event.data.jobId === jobId)).toBe(true)

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

test('upload route rejects an empty submission and a file whose first line is not a My Macros+ header', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const empty = await uploadFiles(page, '/api/nutrition/import/mymacros', [])
  expect(empty.status).toBe(400)

  const bad = await uploadFiles(page, '/api/nutrition/import/mymacros', [
    { name: 'not-an-export.txt', text: 'not a header\nmore text\n' }
  ])
  expect(bad.status).toBe(400)
  expect((bad.json as { data: { fileName: string } }).data.fileName).toBe('not-an-export.txt')
})

test('status route 404s on another user\'s job and 400s on a non-numeric job id', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const upload = await uploadFiles(page, '/api/nutrition/import/mymacros', [
    { name: '2026-09-04.txt', text: fixture('2026-09-04.txt') }
  ])
  const jobId = (upload.json as { jobId: number }).jobId

  await registerViaApi(page, makeUser())
  const stolen = await apiFetch(page, 'GET', `/api/nutrition/import/mymacros/${jobId}`)
  expect(stolen.status).toBe(404)

  const nonNumeric = await apiFetch(page, 'GET', '/api/nutrition/import/mymacros/abc')
  expect(nonNumeric.status).toBe(400)
})

test('settings Data tab queues a My Macros+ import of dropped and picked files', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/data', { waitUntil: 'hydration' })

  const dropZone = page.locator('[data-test="import-mymacros-card"] [role="button"][data-slot="base"]')
  const dataTransfer = await page.evaluateHandle((text) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([text], '2026-09-04.txt', { type: 'text/plain' }))
    return transfer
  }, fixture('2026-09-04.txt'))
  await dropZone.dispatchEvent('dragenter', { dataTransfer })
  await dropZone.dispatchEvent('drop', { dataTransfer })
  await page.locator('input[data-test="import-files"]').setInputFiles({
    name: '2026-09-05.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(fixture('2026-09-05.txt'))
  })

  const card = page.locator('[data-test="import-mymacros-card"]')
  await expect(card).toContainText('2026-09-04.txt')
  await expect(card).toContainText('2026-09-05.txt')

  const upload = page.waitForResponse(
    (response) => response.url().endsWith('/api/nutrition/import/mymacros') && response.request().method() === 'POST'
  )
  await page.locator('[data-test="import-submit"]').click()
  const { jobId } = (await (await upload).json()) as { jobId: number }

  const job = await apiFetch<ImportJobView>(page, 'GET', `/api/nutrition/import/mymacros/${jobId}`)
  expect(job.json.fileCount).toBe(2)
  await expect(page.locator('[data-test="import-status"]')).toContainText('queued')
})
