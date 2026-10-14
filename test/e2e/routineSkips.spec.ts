import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { Routine } from '../../shared/types/routine'
import { apiFetch, makeUser, registerViaApi } from './helpers'

interface AccountExport {
  tables: Record<string, Array<Record<string, unknown>>>
}

async function routineWithDays(page: Page, names: string[]) {
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: 'BLS 5-day' })).json
  let current = routine
  for (const name of names) {
    current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name })).json
  }
  return current
}

const skips = async (page: Page) =>
  (await apiFetch<AccountExport>(page, 'GET', '/api/export')).json.tables.routine_day_skips!.map((s) => ({
    dayName: s.dayName,
    skippedOn: s.skippedOn,
    via: s.via
  }))

test('routine skips: the Skip action and an out-of-order start both record the days passed over', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await routineWithDays(page, ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms'])
  const [, , , legs, arms] = routine.days.map((d) => d.id) as [number, number, number, number, number]

  const skipped = await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/skip`, {
    date: '2026-10-10'
  })
  expect(skipped.status).toBe(200)
  expect(await skips(page)).toEqual([{ dayName: 'Chest', skippedOn: '2026-10-10', via: 'skip' }])

  const started = await apiFetch(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-10-11',
    routineDayId: legs,
    pointer: 'skip'
  })
  expect(started.ok).toBe(true)
  expect(await skips(page)).toEqual([
    { dayName: 'Chest', skippedOn: '2026-10-10', via: 'skip' },
    { dayName: 'Back', skippedOn: '2026-10-11', via: 'start' },
    { dayName: 'Shoulders', skippedOn: '2026-10-11', via: 'start' }
  ])
  expect((await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json.nextDayId).toBe(arms)

  expect(
    (await apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/skip`, { date: 'yesterday' })).status
  ).toBe(400)
})

test('routine skips: keeping the pointer or skipping with no body records sensibly', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await routineWithDays(page, ['Upper', 'Lower'])
  const lower = routine.days[1]!.id

  const kept = await apiFetch(page, 'POST', '/api/workouts/sessions', {
    performedOn: '2026-10-11',
    routineDayId: lower,
    pointer: 'keep'
  })
  expect(kept.ok).toBe(true)
  expect(await skips(page)).toEqual([])
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${(kept.json as { id: number }).id}`, { finish: true })

  expect((await apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/skip`)).status).toBe(200)
  const recorded = await skips(page)
  expect(recorded).toHaveLength(1)
  expect(recorded[0]).toMatchObject({ dayName: 'Upper', via: 'skip' })
})

test('routine skips: the routine page Skip button records today', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await routineWithDays(page, ['Push', 'Pull'])
  await goto(`/workouts/routines/${routine.id}`, { waitUntil: 'hydration' })
  const skipResponse = page.waitForResponse((r) => r.url().endsWith(`/routines/${routine.id}/skip`))
  await page.locator('[data-test="routine-skip"]').click()
  await skipResponse
  const recorded = await skips(page)
  expect(recorded).toHaveLength(1)
  expect(recorded[0]!.dayName).toBe('Push')
})
