import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'

const SAMPLE = readFileSync(new URL('../fixtures/fitnotes/sample.csv', import.meta.url), 'utf8')

interface AccountExport {
  format: string
  version: number
  exportedAt: string
  excluded: Record<string, string>
  tables: Record<string, Array<Record<string, unknown>>>
  reference: Record<string, Array<Record<string, unknown>>>
}

async function seed(page: Page) {
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  const userId = session.json.user.id
  await apiFetch(page, 'PUT', `/api/users/${userId}`, { heightIn: 65.5 })
  await apiFetch(page, 'PUT', '/api/days/2026-10-04/note', { note: 'event day' })
  await apiFetch(page, 'PUT', '/api/body/steps/days/2026-08-24', { steps: 334, partial: true })
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-10-04/entries', [
    {
      entryType: 'quick_add',
      containerId: containers.json[0]!.id,
      description: 'Breakfast',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 474 }
    }
  ])
  await apiFetch(page, 'PUT', '/api/nutrition/diary/2026-10-04/incomplete', { incomplete: true })
  const queued = await apiFetch<{ jobId: number }>(page, 'POST', '/api/workouts/import/fitnotes', { csv: SAMPLE })
  await apiFetch(page, 'POST', '/api/workouts/_test/run-fitnotes-import', { jobId: queued.json.jobId })
  return userId
}

test('account export: every table of the user’s data, nothing of anyone else’s, catalogue names resolved', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const otherId = await seed(page)
  await apiFetch(page, 'DELETE', '/api/_auth/session')

  await registerViaApi(page, makeUser())
  const userId = await seed(page)

  const res = await apiFetch<AccountExport>(page, 'GET', '/api/export')
  expect(res.status).toBe(200)
  const data = res.json
  expect(data).toMatchObject({ format: 'my-fitness-journal-export', version: 1 })
  expect(Object.keys(data.excluded).sort()).toEqual(['import_jobs', 'search_outbox', 'workout_exercise_rollups'])

  expect(data.tables.users).toHaveLength(1)
  expect(data.tables.users![0]).toMatchObject({ id: userId, heightIn: '65.5' })
  expect(data.tables.users![0]).not.toHaveProperty('password')
  expect(data.tables.day_notes).toEqual([expect.objectContaining({ day: '2026-10-04', body: 'event day' })])
  expect(data.tables.step_days).toEqual([expect.objectContaining({ day: '2026-08-24', steps: 334, partial: true })])
  expect(data.tables.diary_days).toEqual([expect.objectContaining({ date: '2026-10-04', incomplete: true })])
  expect(data.tables.diary_entries).toHaveLength(1)
  expect(data.tables.diary_entry_nutrients!.length).toBeGreaterThan(0)
  expect(data.tables.workout_sessions).toHaveLength(3)
  expect(data.tables.workout_sets).toHaveLength(10)
  expect((data.tables.exercises ?? []).map((e) => e.name).sort()).toEqual([
    'Chin Up',
    'Flat Barbell Bench Press',
    'Push Ups',
    'Tall Clean Drill'
  ])

  for (const rows of Object.values(data.tables)) {
    for (const row of rows) {
      for (const key of ['userId', 'createdByUserId']) {
        if (key in row && row[key] !== null) expect(row[key]).toBe(userId)
      }
    }
  }
  expect(data.tables.users!.some((u) => u.id === otherId)).toBe(false)

  const entryExerciseIds = new Set(data.tables.workout_entries!.map((e) => e.exerciseId))
  const named = new Map(
    [...data.tables.exercises!, ...data.reference.exercises!].map((e) => [e.id as number, e.name as string])
  )
  for (const id of entryExerciseIds) expect(named.has(id as number)).toBe(true)
  expect(data.reference.exercises!.map((e) => e.name)).toEqual(
    expect.arrayContaining(['Barbell Squat', 'Elliptical Trainer'])
  )
  expect(data.reference.nutrients!.some((n) => n.key === 'energy')).toBe(true)

  expect((await apiFetch(page, 'GET', '/api/export?today=2026-13-01')).status).toBe(400)
  await apiFetch(page, 'DELETE', '/api/_auth/session')
  expect((await apiFetch(page, 'GET', '/api/export')).status).toBe(401)
})

test('account export: the Data settings page downloads a dated JSON file', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/settings/data', { waitUntil: 'hydration' })
  const download = page.waitForEvent('download')
  await page.locator('[data-test="export-download"]').click()
  const file = await download
  expect(file.suggestedFilename()).toBe(`my-fitness-journal-${todayDate()}.json`)
  const body = JSON.parse(readFileSync((await file.path())!, 'utf8')) as AccountExport
  expect(body.format).toBe('my-fitness-journal-export')
  expect(body.tables.users).toHaveLength(1)
})
