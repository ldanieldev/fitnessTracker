import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Routine, RoutineSummary } from '../../shared/types/routine'
import type { Exercise, ExerciseCategory } from '../../shared/types/workout'
import { holdLocks } from './dbLock'

async function newRoutine(page: Page, name = uniquePrefix('Routine ')) {
  return (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name })).json
}

test('routine CRUD without days', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  expect(routine).toMatchObject({ active: false, nextDayId: null, days: [] })

  const renamed = await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { name: 'Upper/Lower', notes: 'BLS' })
  expect(renamed.json).toMatchObject({ name: 'Upper/Lower', notes: 'BLS' })

  const noDays = await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { active: true })
  expect(noDays.status).toBe(400)

  const list = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
  expect(list.find((r) => r.id === routine.id)).toMatchObject({ dayCount: 0, nextDay: null, active: false })

  expect((await apiFetch(page, 'DELETE', `/api/workouts/routines/${routine.id}`)).status).toBe(200)
  expect((await apiFetch(page, 'GET', `/api/workouts/routines/${routine.id}`)).status).toBe(404)
})

test('another user cannot see or change a routine', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  await registerViaApi(page, makeUser())
  expect((await apiFetch(page, 'GET', `/api/workouts/routines/${routine.id}`)).status).toBe(404)
  expect((await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { name: 'x' })).status).toBe(404)
  expect((await apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/skip`)).status).toBe(404)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/routines/${routine.id}`)).status).toBe(404)
})

async function exercise(page: Page, trackingType = 'weight_reps') {
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  return (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Routine Ex '), categoryId: chest.id, trackingType, loadStyle: 'plain'
  })).json
}

async function addDay(page: Page, routineId: number, name: string, floating = false) {
  return (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routineId}/days`, { name, floating })).json
}

test('days: order, floating, pointer, skip, make next, activate, duplicate', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  await addDay(page, routine.id, 'Upper A')
  await addDay(page, routine.id, 'Pump', true)
  let current = await addDay(page, routine.id, 'Lower A')
  const [upper, pump, lower] = current.days.map((d) => d.id) as [number, number, number]
  expect(current.nextDayId).toBe(upper)

  const floatingNext = await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: pump })
  expect(floatingNext.status).toBe(400)

  current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/skip`)).json
  expect(current.nextDayId).toBe(lower)
  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: upper })).json
  expect(current.nextDayId).toBe(upper)

  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routine-days/${lower}`, { sortOrder: 0, description: 'Squat focus' })).json
  expect(current.days.map((d) => d.id)).toEqual([lower, upper, pump])
  expect(current.days[0]!.description).toBe('Squat focus')

  current = (await apiFetch<Routine>(page, 'DELETE', `/api/workouts/routine-days/${upper}`)).json
  expect(current.nextDayId).toBe(lower)

  const other = await newRoutine(page)
  await addDay(page, other.id, 'Only')
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { active: true })
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${other.id}`, { active: true })
  const list = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
  expect(list.filter((r) => r.active).map((r) => r.id)).toEqual([other.id])

  const copy = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/duplicate`)).json
  expect(copy.name.endsWith('(copy)')).toBe(true)
  expect(copy.active).toBe(false)
  expect(copy.days.map((d) => d.name)).toEqual(['Lower A', 'Pump'])
})

test('routine exercises: targets, range check, groups, reorder, deleted exercises', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  const dayId = (await addDay(page, routine.id, 'Day')).days[0]!.id
  const ex = [await exercise(page), await exercise(page), await exercise(page), await exercise(page, 'time')]
  let current = routine
  for (const e of ex) {
    current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId: e.id })).json
  }
  const entries = current.days[0]!.entries
  expect(entries[0]!.target).toEqual({ sets: 3, low: null, high: null, weight: null })
  const [a, b, c, plank] = entries.map((e) => e.id) as [number, number, number, number]

  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routine-entries/${a}`, {
    targetLow: 5, targetHigh: 8, restSeconds: 180, optional: true, notes: 'per side'
  })).json
  expect(current.days[0]!.entries[0]).toMatchObject({
    target: { sets: 3, low: 5, high: 8, weight: null }, restSeconds: 180, optional: true, notes: 'per side'
  })
  expect(current.days[0]!.entries[3]!.trackingType).toBe('time')
  expect((await apiFetch(page, 'PATCH', `/api/workouts/routine-entries/${a}`, { targetLow: 9 })).status).toBe(400)

  current = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayId}/group`, { entryIds: [a, c] })).json
  expect(current.days[0]!.entries.map((e) => e.id)).toEqual([a, c, b, plank])
  current = (await apiFetch<Routine>(page, 'PATCH', `/api/workouts/routine-entries/${b}`, { sortOrder: 0 })).json
  expect(current.days[0]!.entries.map((e) => e.id)).toEqual([b, a, c, plank])

  await apiFetch(page, 'DELETE', `/api/workouts/exercises/${ex[2]!.id}`)
  current = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json
  expect(current.days[0]!.entries.find((e) => e.id === c)!.deleted).toBe(true)

  current = (await apiFetch<Routine>(page, 'DELETE', `/api/workouts/routine-entries/${c}`)).json
  expect(current.days[0]!.entries.find((e) => e.id === a)!.supersetGroup).toBeNull()
  expect(current.days[0]!.entries.map((e) => e.sortOrder)).toEqual([0, 1, 2])

  const deletedAdd = await apiFetch(page, 'POST', `/api/workouts/routine-days/${dayId}/entries`, { exerciseId: ex[2]!.id })
  expect(deletedAdd.status).toBe(404)
})

test('concurrent day adds, exercise adds and skips each land once', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  await addDay(page, routine.id, 'Day A')
  const read = async () => (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json

  const routineLock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const dayAdds = ['Day B', 'Day C'].map((name) => apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name }))
  try {
    await routineLock.waitForBlocked(2)
  } finally {
    await routineLock.release()
  }
  expect((await Promise.all(dayAdds)).map((r) => r.status)).toEqual([200, 200])
  let current = await read()
  expect(current.days.map((d) => d.sortOrder)).toEqual([0, 1, 2])

  const dayA = current.days[0]!.id
  const [e1, e2] = [await exercise(page), await exercise(page)]
  const entryLock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const entryAdds = [e1, e2].map((e) => apiFetch(page, 'POST', `/api/workouts/routine-days/${dayA}/entries`, { exerciseId: e.id }))
  try {
    await entryLock.waitForBlocked(2)
  } finally {
    await entryLock.release()
  }
  expect((await Promise.all(entryAdds)).map((r) => r.status)).toEqual([200, 200])
  current = await read()
  expect(current.days[0]!.entries.map((e) => e.sortOrder)).toEqual([0, 1])

  const order = current.days.map((d) => d.id)
  expect(current.nextDayId).toBe(order[0])
  const skipLock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const skips = [1, 2].map(() => apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/skip`))
  try {
    await skipLock.waitForBlocked(2)
  } finally {
    await skipLock.release()
  }
  expect((await Promise.all(skips)).map((r) => r.status)).toEqual([200, 200])
  expect((await read()).nextDayId).toBe(order[2])
})

test('two sibling day deletes both land and renumber without a deadlock', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  for (const name of ['Day A', 'Day B', 'Day C']) await addDay(page, routine.id, name)
  const [a, b, c] = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json.days.map((d) => d.id)

  const lock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  let deletes: Promise<{ status: number }>[] | undefined
  try {
    // The surviving sibling too, so deleters that skip the routine lock still queue on the renumber.
    await lock.client.query('select id from app.workout_templates where id = $1 for update', [a])
    deletes = [b, c].map((id) => apiFetch(page, 'DELETE', `/api/workouts/routine-days/${id}`))
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }
  expect((await Promise.all(deletes!)).map((r) => r.status)).toEqual([200, 200])
  const after = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json
  expect(after.days.map((d) => [d.id, d.sortOrder])).toEqual([[a, 0]])
})

test('two routines activated at once both land without a deadlock, leaving exactly one active', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [a, b] = [await newRoutine(page), await newRoutine(page)]
  await addDay(page, a.id, 'Day A')
  await addDay(page, b.id, 'Day B')

  const lock = await holdLocks('select id from app.routines where id = any($1) order by id for update', [[a.id, b.id]])
  const activations = [b, a].map((r) => apiFetch(page, 'PATCH', `/api/workouts/routines/${r.id}`, { active: true }))
  try {
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }
  expect((await Promise.all(activations)).map((r) => r.status)).toEqual([200, 200])
  const list = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
  expect(list.filter((r) => r.active)).toHaveLength(1)
})

test('an activation does not deadlock with phase inserts that reference routines out of id order', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const a = await newRoutine(page)
  const b = await newRoutine(page)
  await addDay(page, a.id, 'Day A')
  const program = (await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/programs', { name: uniquePrefix('Race ') })).json
  const insert = 'insert into app.program_phases (program_id, name, sort_order, weeks, routine_id) values ($1, $2, $3, 1, $4)'

  const lock = await holdLocks(insert, [program.id, 'First', 0, b.id])
  let settled = false
  const activation = apiFetch(page, 'PATCH', `/api/workouts/routines/${a.id}`, { active: true }).finally(() => {
    settled = true
  })
  let second: string
  try {
    await expect.poll(async () => settled || (await lock.queued()) > 0).toBe(true)
    second = await lock.client.query(insert, [program.id, 'Second', 1, a.id]).then(() => 'inserted', (err) => err.code)
  } finally {
    await lock.release({ rollback: true })
  }
  expect(second).toBe('inserted')
  expect((await activation).status).toBe(200)
  const list = (await apiFetch<RoutineSummary[]>(page, 'GET', '/api/workouts/routines')).json
  expect(list.filter((r) => r.active).map((r) => r.id)).toEqual([a.id])
})

test('the log page waits for the routine list before showing the start buttons', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await newRoutine(page)
  await addDay(page, routine.id, 'Day A')
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { active: true })
  await goto('/workouts/progress', { waitUntil: 'hydration' })

  await page.evaluate(() => {
    const w = window as unknown as { firstStartHadNext?: boolean }
    new MutationObserver((_, observer) => {
      if (!document.querySelector('[data-test="session-start"]')) return
      w.firstStartHadNext = document.querySelector('[data-test="start-routine-next"]') !== null
      observer.disconnect()
    }).observe(document.body, { childList: true, subtree: true })
  })
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route((url) => url.pathname === '/api/workouts/routines', async (route) => {
    await gate
    await route.continue()
  })
  const held = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/workouts/routines')
  const sessionLoaded = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/workouts/sessions/active')
  try {
    await page.getByRole('link', { name: 'Log Workout' }).click()
    await held
    await sessionLoaded
  } finally {
    release()
  }
  await expect(page.locator('[data-test="start-routine-next"]')).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { firstStartHadNext?: boolean }).firstStartHadNext)).toBe(true)
})
