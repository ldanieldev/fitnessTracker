import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, ExerciseHistorySession, WorkoutSession } from '../../shared/types/workout'

test('workout history: newest first, records and totals, paged by limit', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const log = async (performedOn: string, weight: number) => {
    const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    const entry = (
      await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
        exerciseId: bench.id
      })
    ).json.entries[0]!
    await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight, reps: 5 })
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
    return session.id
  }

  const older = await log('2026-02-01', 185)
  const newer = await log('2026-02-08', 205)

  const all = (await apiFetch<ExerciseHistorySession[]>(page, 'GET', `/api/workouts/exercises/${bench.id}/history`))
    .json
  expect(all.map((s) => s.sessionId)).toEqual([newer, older])
  expect(all[0]!.totals).toMatchObject({ sets: 1, volume: 205 * 5, topWeight: 205, topWeightReps: 5 })
  expect(all[0]!.sets[0]!.records).toEqual([{ kind: 'weight_reps', previous: 185 }])
  expect(all[1]!.sets[0]!.records).toEqual([])

  const paged = (
    await apiFetch<ExerciseHistorySession[]>(page, 'GET', `/api/workouts/exercises/${bench.id}/history?limit=1`)
  ).json
  expect(paged.map((s) => s.sessionId)).toEqual([newer])
})

test('workout history: keyset pages have no gaps or repeats, and the list loads more past a deleted cursor', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  for (let i = 0; i < 25; i++) {
    // Two workouts a day, so the cursor must break performedOn ties by start time and id.
    const performedOn = `2026-01-${String(10 + Math.floor(i / 2)).padStart(2, '0')}`
    const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
    await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  }
  type Summary = { id: number }
  const all = (await apiFetch<Summary[]>(page, 'GET', '/api/workouts/sessions?limit=1000')).json.map((s) => s.id)
  expect(all).toHaveLength(25)

  const paged: number[] = []
  let before: number | undefined
  for (;;) {
    const url = `/api/workouts/sessions?limit=7${before ? `&before=${before}` : ''}`
    const batch = (await apiFetch<Summary[]>(page, 'GET', url)).json
    paged.push(...batch.map((s) => s.id))
    if (batch.length < 7) break
    before = batch.at(-1)!.id
  }
  expect(paged).toEqual(all)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions?before=abc')).status).toBe(400)

  await goto('/workouts/sessions', { waitUntil: 'hydration' })
  await page.locator('[data-test="history-view-list"]').click()
  const rows = page.locator('[data-test="session-row"]')
  await expect(rows).toHaveCount(20)
  // Deleting the last loaded workout elsewhere removes the cursor the next page asks for.
  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${all[19]}`)
  expect((await apiFetch(page, 'GET', `/api/workouts/sessions?limit=7&before=${all[19]}`)).status).toBe(410)
  await page.locator('[data-test="session-list-end"]').scrollIntoViewIfNeeded()
  await expect(rows).toHaveCount(24)
  await expect(page.locator('[data-test="session-list-end"]')).toHaveCount(0)
})
