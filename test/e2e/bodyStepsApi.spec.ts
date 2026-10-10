import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { StepDay, StepTarget, StepWeek } from '../../shared/types/steps'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { weekStartOf } from '../../shared/utils/programs'

async function signUp(page: Page, weekStart: 0 | 1 = 0) {
  await registerViaApi(page, makeUser())
  const session = await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')
  await apiFetch(page, 'PUT', `/api/users/${session.json.user.id}`, { weekStart })
}

const weeks = (page: Page, count = 1) => apiFetch<StepWeek[]>(page, 'GET', `/api/body/steps/weeks?count=${count}`)

test('empty user: the current week comes back untracked and there is no target', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const res = await weeks(page, 26)
  expect(res.status).toBe(200)
  expect(res.json).toHaveLength(1)
  expect(res.json[0]!.start).toBe(weekStartOf(todayDate(), 0))
  expect(res.json[0]!).toMatchObject({ total: 0, logged: 0, average: null, budget: null, met: null })
  expect((await apiFetch(page, 'GET', '/api/body/steps/target')).json).toEqual({ target: null })
})

test('upsert replaces a day, validation rejects bad input, delete removes it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()

  const lookup = () => apiFetch<{ day: StepDay | null }>(page, 'GET', `/api/body/steps/days/${today}`)
  expect((await lookup()).json).toEqual({ day: null })
  const first = await apiFetch<StepDay>(page, 'PUT', `/api/body/steps/days/${today}`, { steps: 5000 })
  expect(first.json).toEqual({ date: today, steps: 5000 })
  await apiFetch(page, 'PUT', `/api/body/steps/days/${today}`, { steps: 7000 })
  expect((await weeks(page)).json[0]!).toMatchObject({ total: 7000, logged: 1 })
  expect((await lookup()).json).toEqual({ day: { date: today, steps: 7000 } })
  expect((await apiFetch(page, 'GET', '/api/body/steps/days/2026-02-30')).status).toBe(400)

  for (const [date, body] of [
    [shiftDate(today, 2), { steps: 100 }],
    ['2026-02-30', { steps: 100 }],
    [today, { steps: 1.5 }],
    [today, { steps: -1 }],
    [today, { steps: 200001 }]
  ] as const) {
    expect((await apiFetch(page, 'PUT', `/api/body/steps/days/${date}`, body)).status).toBe(400)
  }
  expect((await apiFetch(page, 'PUT', `/api/body/steps/days/${today}`, { steps: 200000 })).status).toBe(200)

  expect((await apiFetch(page, 'DELETE', `/api/body/steps/days/${today}`)).json).toEqual({ ok: true })
  expect((await weeks(page)).json[0]!).toMatchObject({ total: 0, logged: 0 })
})

test('a target sets the budget and pace, and target history judges each week by its own target', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  const thisWeek = weekStartOf(today, 0)
  const oldWeek = shiftDate(thisWeek, -21)

  await apiFetch(page, 'PUT', `/api/body/steps/days/${oldWeek}`, { steps: 8500 })
  await apiFetch(page, 'PUT', `/api/body/steps/days/${today}`, { steps: 3000 })
  await apiFetch<StepTarget>(page, 'PUT', '/api/body/steps/target', { dailyTarget: 8000, effectiveFrom: oldWeek })
  const set = await apiFetch<StepTarget>(page, 'PUT', '/api/body/steps/target', {
    dailyTarget: 9000,
    effectiveFrom: thisWeek
  })
  expect(set.json).toEqual({ dailyTarget: 9000, effectiveFrom: thisWeek })
  expect((await apiFetch(page, 'GET', '/api/body/steps/target')).json).toEqual({ target: set.json })

  const list = (await weeks(page, 10)).json
  expect(list.map((w) => w.start)).toEqual([0, 1, 2, 3].map((i) => shiftDate(thisWeek, -7 * i)))
  expect(list[0]!).toMatchObject({ total: 3000, budget: 63000, remaining: 60000 })
  expect(list[0]!.neededPerDay).toBe(list[0]!.openDays ? Math.ceil(60000 / list[0]!.openDays) : null)
  expect(list[1]!).toMatchObject({ logged: 0, met: null, budget: 56000 })
  expect(list[3]!).toMatchObject({ logged: 1, total: 8500, budget: 56000, met: true, remaining: null })

  const again = await apiFetch<StepTarget>(page, 'PUT', '/api/body/steps/target', {
    dailyTarget: 10000,
    effectiveFrom: thisWeek
  })
  expect(again.json.dailyTarget).toBe(10000)
  expect((await weeks(page)).json[0]!.budget).toBe(70000)
})

test('weeks follow the Monday week start', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page, 1)
  const start = (await weeks(page)).json[0]!.start
  expect(start).toBe(weekStartOf(todayDate(), 1))
  expect(new Date(`${start}T00:00:00Z`).getUTCDay()).toBe(1)
})

test('isolation: another user sees neither steps nor target, and anonymous calls are refused', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  await apiFetch(page, 'PUT', `/api/body/steps/days/${today}`, { steps: 9000 })
  await apiFetch(page, 'PUT', '/api/body/steps/target', { dailyTarget: 8000, effectiveFrom: today })

  await signUp(page)
  expect((await weeks(page)).json[0]!).toMatchObject({ total: 0, budget: null })
  expect((await apiFetch(page, 'GET', '/api/body/steps/target')).json).toEqual({ target: null })
  expect((await apiFetch(page, 'GET', `/api/body/steps/days/${today}`)).json).toEqual({ day: null })

  await apiFetch(page, 'DELETE', '/api/_auth/session')
  expect((await weeks(page)).status).toBe(401)
  expect((await apiFetch(page, 'PUT', `/api/body/steps/days/${today}`, { steps: 1 })).status).toBe(401)
})

test('the client day decides the current week and the target in force', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  const thisWeek = weekStartOf(today, 0)
  const lastSaturday = shiftDate(thisWeek, -1)
  await apiFetch(page, 'PUT', '/api/body/steps/target', { dailyTarget: 8000, effectiveFrom: thisWeek })
  await apiFetch(page, 'PUT', `/api/body/steps/days/${lastSaturday}`, { steps: 4000 })

  const behind = await apiFetch<StepWeek[]>(page, 'GET', `/api/body/steps/weeks?count=1&to=${lastSaturday}`)
  expect(behind.json[0]!).toMatchObject({ start: shiftDate(thisWeek, -7), end: lastSaturday, total: 4000 })
  expect(behind.json[0]!.openDays).toBeNull()
  expect((await apiFetch(page, 'GET', `/api/body/steps/target?to=${lastSaturday}`)).json).toEqual({ target: null })
  expect((await apiFetch(page, 'GET', `/api/body/steps/target?to=${thisWeek}`)).json).toEqual({
    target: { dailyTarget: 8000, effectiveFrom: thisWeek }
  })
  expect((await apiFetch(page, 'GET', '/api/body/steps/weeks?to=2026-02-30')).status).toBe(400)

  // A client ahead of the server's clock (east of it) may log its own "today", one day past the server's.
  expect((await apiFetch(page, 'PUT', `/api/body/steps/days/${shiftDate(today, 1)}`, { steps: 100 })).status).toBe(200)
})
