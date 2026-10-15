import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import { todayDate } from '../../shared/utils/nutritionSummary'
import type { WorkoutSession } from '../../shared/types/workout'

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
  expect(Object.keys(data.excluded).sort()).toEqual([
    'access_tokens',
    'import_jobs',
    'search_outbox',
    'workout_exercise_rollups'
  ])

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
  expect(data.reference.measurement_types!.map((t) => t.key)).toEqual(
    expect.arrayContaining(['bodyweight', 'waist'])
  )

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

test('account export: date range keeps only dated rows inside it and the whole of everything else', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const dates = ['2026-10-01', '2026-10-04', '2026-10-09']
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  const types = await apiFetch<Array<{ id: number; key: string }>>(page, 'GET', '/api/body/types')
  const weight = types.json.find((t) => t.key === 'bodyweight')!
  const profile = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })
  const reference = await apiFetch<{ categories: { id: number; key: string }[] }>(
    page,
    'GET',
    '/api/workouts/reference'
  )
  const exercise = await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Range Curl '),
    categoryId: reference.json.categories.find((c) => c.key === 'core')!.id,
    trackingType: 'weight_reps'
  })
  expect(exercise.status).toBeLessThan(300)
  for (const date of dates) {
    await apiFetch(page, 'PUT', `/api/days/${date}/note`, { note: `note ${date}` })
    await apiFetch(page, 'PUT', `/api/body/steps/days/${date}`, { steps: 1000, partial: false })
    await apiFetch(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
      {
        entryType: 'quick_add',
        containerId: containers.json[0]!.id,
        description: `Meal ${date}`,
        quantity: 1,
        unitLabel: 'serving',
        nutrients: { energy: 300 }
      }
    ])
    await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 180, measuredOn: date })
    await apiFetch(page, 'PUT', `/api/nutrition/diary/${date}/goal`, { profileId: profile.json.id })
    await apiFetch(page, 'PUT', `/api/nutrition/diary/${date}/meal-time`, {
      containerId: containers.json[0]!.id,
      time: '08:00'
    })
    const session = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: date })
    const entry = await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.json.id}/entries`, {
      exerciseId: exercise.json.id
    })
    expect(entry.status, `entry ${date}`).toBeLessThan(300)
    const set = await apiFetch(page, 'POST', `/api/workouts/entries/${entry.json.entries[0]!.id}/sets`, {
      weight: 50,
      reps: 8
    })
    expect(set.status).toBeLessThan(300)
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.json.id}`, { finish: true })
  }

  const ranged = await apiFetch<AccountExport & { range?: unknown }>(
    page,
    'GET',
    '/api/export?from=2026-10-02&to=2026-10-08'
  )
  expect(ranged.status).toBe(200)
  const t = ranged.json.tables
  expect(t.day_notes).toEqual([expect.objectContaining({ day: '2026-10-04' })])
  expect(t.step_days).toEqual([expect.objectContaining({ day: '2026-10-04' })])
  expect(t.measurements).toEqual([expect.objectContaining({ measuredOn: '2026-10-04' })])
  expect(t.diary_days).toEqual([expect.objectContaining({ date: '2026-10-04' })])
  expect(t.diary_entries).toHaveLength(1)
  expect(t.diary_entries![0]!.dayId).toBe(t.diary_days![0]!.id)
  const dayId = t.diary_days![0]!.id
  expect(t.diary_day_targets!.length).toBeGreaterThan(0)
  expect(t.diary_day_targets!.every((r) => r.dayId === dayId)).toBe(true)
  expect(t.diary_meal_times).toEqual([expect.objectContaining({ dayId, time: '08:00' })])
  expect(t.workout_sessions).toEqual([expect.objectContaining({ performedOn: '2026-10-04' })])
  expect(t.workout_entries).toEqual([expect.objectContaining({ sessionId: t.workout_sessions![0]!.id })])
  expect(t.workout_sets).toEqual([expect.objectContaining({ entryId: t.workout_entries![0]!.id })])
  expect(ranged.json.range).toEqual({ from: '2026-10-02', to: '2026-10-08' })
  expect(t.goal_profiles!.length).toBeGreaterThan(0)

  const disposition = await page.evaluate(async () => {
    const res = await fetch('/api/export?from=2026-10-02&to=2026-10-08')
    return res.headers.get('content-disposition')
  })
  expect(disposition).toMatch(/-2026-10-02_2026-10-08\.json"$/)

  const open = await apiFetch<AccountExport>(page, 'GET', '/api/export?from=2026-10-05')
  expect(open.json.tables.day_notes).toEqual([expect.objectContaining({ day: '2026-10-09' })])
  expect(open.json.tables.diary_days).toEqual([expect.objectContaining({ date: '2026-10-09' })])

  expect((await apiFetch(page, 'GET', '/api/export?from=2026-10-09&to=2026-10-01')).status).toBe(400)
  const whole = await apiFetch<AccountExport>(page, 'GET', '/api/export')
  expect(whole.json).not.toHaveProperty('range')
  expect(whole.json.tables.day_notes).toHaveLength(3)
})
