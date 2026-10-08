import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Routine } from '../../shared/types/routine'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../shared/types/workout'
import { todayDate } from '../../shared/utils/nutritionSummary'
import { holdLocks } from './dbLock'

export async function customExercise(page: Parameters<typeof apiFetch>[0], trackingType = 'weight_reps') {
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  return (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Start Test '), categoryId: chest.id, trackingType, loadStyle: 'plain'
  })).json
}

test('an ad-hoc workout carries no targets, no group and no routine day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const exercise = await customExercise(page)

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  expect(session.routineDayId).toBeNull()
  const withEntry = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: exercise.id
  })).json
  expect(withEntry.entries[0]).toMatchObject({ target: null, supersetGroup: null, optional: false, restOverrideSeconds: null })
  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${session.id}`)
})

async function adHocWorkout(page: Parameters<typeof apiFetch>[0], count: number) {
  const exercises = []
  for (let i = 0; i < count; i++) exercises.push(await customExercise(page))
  let session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json
  for (const exercise of exercises) {
    session = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
      exerciseId: exercise.id
    })).json
  }
  return session
}

test('grouping live entries keeps them adjacent, reorder steps over a group, ungroup dissolves pairs',
  async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())
    const session = await adHocWorkout(page, 4)
    const [a, b, c, d] = session.entries.map((e) => e.id) as [number, number, number, number]

    const grouped = await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/group`, {
      entryIds: [a, c]
    })
    expect(grouped.status).toBe(200)
    expect(grouped.json.entries.map((e) => e.id)).toEqual([a, c, b, d])
    expect(new Set(grouped.json.entries.slice(0, 2).map((e) => e.supersetGroup)).size).toBe(1)
    expect(grouped.json.entries[0]!.supersetGroup).not.toBeNull()

    const stepped = (await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/entries/${b}`, { sortOrder: 1 })).json
    expect(stepped.entries.map((e) => e.id)).toEqual([b, a, c, d])

    const ungrouped = (await apiFetch<WorkoutSession>(page, 'PATCH', `/api/workouts/entries/${a}`, {
      supersetGroup: null
    })).json
    expect(ungrouped.entries.every((e) => e.supersetGroup === null)).toBe(true)

    expect((await apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/group`, { entryIds: [a] })).status)
      .toBe(400)
    expect((await apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/group`, { entryIds: [a, 999999] }))
      .status).toBe(400)

    await apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/group`, { entryIds: [c, d] })
    const afterDelete = (await apiFetch<WorkoutSession>(page, 'DELETE', `/api/workouts/entries/${d}`)).json
    expect(afterDelete.entries.find((e) => e.id === c)!.supersetGroup).toBeNull()
    expect(afterDelete.entries.map((e) => e.sortOrder)).toEqual([0, 1, 2])
    await apiFetch(page, 'DELETE', `/api/workouts/sessions/${session.id}`)
  })

test('two live reorders queued on the same workout leave distinct positions', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await adHocWorkout(page, 3)
  const [, b, c] = session.entries.map((e) => e.id) as [number, number, number]

  const lock = await holdLocks('select id from app.workout_entries where session_id = $1 order by id for update', [session.id])
  const first = apiFetch(page, 'PATCH', `/api/workouts/entries/${c}`, { sortOrder: 0 })
  let second: ReturnType<typeof apiFetch> | undefined
  try {
    await lock.waitForBlocked(1)
    second = apiFetch(page, 'PATCH', `/api/workouts/entries/${b}`, { sortOrder: 0 })
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }
  expect([(await first).status, (await second!).status]).toEqual([200, 200])
  const after = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${session.id}`)).json
  expect(after.entries.map((e) => e.sortOrder).sort()).toEqual([0, 1, 2])
  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${session.id}`)
})

test('exercise adds queued behind a running regroup take the next free positions', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await adHocWorkout(page, 3)
  const [, , c] = session.entries.map((e) => e.id) as [number, number, number]
  const [x, y] = [await customExercise(page), await customExercise(page)]

  const lock = await holdLocks('select id from app.workout_entries where session_id = $1 order by id for update', [session.id])
  const writes: ReturnType<typeof apiFetch>[] = []
  try {
    writes.push(apiFetch(page, 'PATCH', `/api/workouts/entries/${c}`, { sortOrder: 0 }))
    await lock.waitForBlocked(1)
    writes.push(...[x, y].map((e) => apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId: e.id })))
    await lock.waitForBlocked(3)
  } finally {
    await lock.release()
  }
  expect((await Promise.all(writes)).map((r) => r.status)).toEqual([200, 200, 200])
  const after = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${session.id}`)).json
  expect(after.entries.map((e) => e.sortOrder).sort()).toEqual([0, 1, 2, 3, 4])
  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${session.id}`)
})

test('an exercise add queued behind a workout delete answers 404, not a deadlock', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await adHocWorkout(page, 2)
  const extra = await customExercise(page)

  const lock = await holdLocks('delete from app.workout_sessions where id = $1', [session.id])
  const added = apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId: extra.id })
  try {
    await lock.waitForBlocked(1)
  } finally {
    await lock.release()
  }
  expect((await added).status).toBe(404)
  expect((await apiFetch(page, 'GET', `/api/workouts/sessions/${session.id}`)).status).toBe(404)
})

test('two exercise adds on an empty workout take distinct positions', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const session = await adHocWorkout(page, 0)
  const [x, y] = [await customExercise(page), await customExercise(page)]

  const lock = await holdLocks('select id from app.workout_sessions where id = $1 for update', [session.id])
  let adds: ReturnType<typeof apiFetch>[] | undefined
  try {
    adds = [x, y].map((e) => apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId: e.id }))
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }
  expect((await Promise.all(adds!)).map((r) => r.status)).toEqual([200, 200])
  const after = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${session.id}`)).json
  expect(after.entries.map((e) => e.sortOrder).sort()).toEqual([0, 1])
  await apiFetch(page, 'DELETE', `/api/workouts/sessions/${session.id}`)
})

async function routineWithDays(page: Parameters<typeof apiFetch>[0]) {
  const [bench, row, pull] = [await customExercise(page), await customExercise(page), await customExercise(page)]
  let routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('Start R ') })).json
  for (const [name, floating] of [['Day A', false], ['Day B', false], ['Day C', false], ['Pump', true]] as const) {
    routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name, floating })).json
  }
  const dayA = routine.days[0]!.id
  for (const e of [bench, row, pull]) {
    routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayA}/entries`, { exerciseId: e.id })).json
  }
  const [eBench, eRow] = routine.days[0]!.entries
  await apiFetch(page, 'PATCH', `/api/workouts/routine-entries/${eBench!.id}`, { targetLow: 5, targetHigh: 8, restSeconds: 150 })
  routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${dayA}/group`, { entryIds: [eBench!.id, eRow!.id] })).json
  return { routine, exercises: { bench, row, pull } }
}

const days = (r: Routine) => r.days.map((d) => d.id) as [number, number, number, number]
const getRoutine = async (page: Parameters<typeof apiFetch>[0], id: number) =>
  (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${id}`)).json
const finish = (page: Parameters<typeof apiFetch>[0], id: number) =>
  apiFetch(page, 'PATCH', `/api/workouts/sessions/${id}`, { finish: true })

test('starting the due day copies targets and groups and advances the pointer', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const { routine } = await routineWithDays(page)
  const [a, b] = days(routine)

  const started = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: a })
  expect(started.status).toBe(200)
  expect(started.json).toMatchObject({ name: 'Day A', routineDayId: a })
  const [first, second, third] = started.json.entries
  expect(first).toMatchObject({ target: { sets: 3, low: 5, high: 8, weight: null }, restOverrideSeconds: 150 })
  expect(first!.supersetGroup).not.toBeNull()
  expect(second!.supersetGroup).toBe(first!.supersetGroup)
  expect(third!.supersetGroup).toBeNull()
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(b)
  await finish(page, started.json.id)
})

test('off-order days need a choice; skip moves past, keep holds; floating never moves', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const { routine } = await routineWithDays(page)
  const [a, b, c, pump] = days(routine)

  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: c })).status).toBe(400)

  const kept = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: c, pointer: 'keep' })).json
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(a)
  await finish(page, kept.id)

  const floating = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: pump })).json
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(a)
  await finish(page, floating.id)

  const skipped = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: b, pointer: 'skip' })).json
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(c)
  await finish(page, skipped.id)
})

test('409 leaves the pointer', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const { routine } = await routineWithDays(page)
  const [a] = days(routine)
  const open = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json

  const refused = await apiFetch<{ data: { session: WorkoutSession } }>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: a })
  expect(refused.status).toBe(409)
  expect(refused.json.data.session.id).toBe(open.id)
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(a)
  await finish(page, open.id)
})

test('deleted exercise is skipped and its superset dissolves', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const { routine, exercises } = await routineWithDays(page)
  await apiFetch(page, 'DELETE', `/api/workouts/exercises/${exercises.row.id}`)

  const started = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), routineDayId: days(routine)[0] })).json
  expect(started.entries.map((e) => e.exerciseId)).toEqual([exercises.bench.id, exercises.pull.id])
  expect(started.entries.every((e) => e.supersetGroup === null)).toBe(true)
  await finish(page, started.id)
})

test('copy with a checklist brings set counts and ranges', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const source = await adHocWorkout(page, 3)
  const [a, b, c] = source.entries.map((e) => e.id) as [number, number, number]
  for (const reps of [8, 7, 6]) await apiFetch(page, 'POST', `/api/workouts/entries/${a}/sets`, { weight: 100, reps })
  await apiFetch(page, 'POST', `/api/workouts/entries/${c}/sets`, { weight: 50, reps: 12 })
  await finish(page, source.id)

  const copy = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), copyFromId: source.id, entryIds: [a, c] })
  expect(copy.status).toBe(200)
  expect(copy.json.routineDayId).toBeNull()
  expect(copy.json.entries.map((e) => e.exerciseId)).toEqual([source.entries[0]!.exerciseId, source.entries[2]!.exerciseId])
  expect(copy.json.entries[0]!.target).toEqual({ sets: 3, low: 6, high: 8, weight: null })
  expect(copy.json.entries[1]!.target).toEqual({ sets: 1, low: 12, high: 12, weight: null })
  await finish(page, copy.json.id)

  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), copyFromId: source.id, entryIds: [999999] })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), entryIds: [b] })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), copyFromId: source.id, routineDayId: 1 })).status).toBe(400)
})

async function threeDayRoutine(page: Parameters<typeof apiFetch>[0]) {
  let routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('Lock R ') })).json
  for (const name of ['Day A', 'Day B', 'Day C']) {
    routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name })).json
  }
  return routine
}

test('a Make next that lands while a start waits wins, and the start then needs a choice', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a, , c] = days(routine)

  const lock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const started = apiFetch(page, 'POST', '/api/workouts/sessions', { routineDayId: a, performedOn: todayDate() })
  try {
    await lock.client.query('update app.routines set next_day_id = $1 where id = $2', [c, routine.id])
    await lock.waitForBlocked(1)
  } finally {
    await lock.release()
  }

  expect((await started).status).toBe(400)
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(c)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).status).toBe(204)
})

test('a day deleted while its start waits answers 404, not 500', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a] = days(routine)

  const lock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const started = apiFetch(page, 'POST', '/api/workouts/sessions', { routineDayId: a, performedOn: todayDate() })
  try {
    await lock.client.query('delete from app.workout_templates where id = $1', [a])
    await lock.waitForBlocked(1)
  } finally {
    await lock.release()
  }

  expect((await started).status).toBe(404)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).status).toBe(204)
})

test('a second start is refused before the copy source is read', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const open = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate() })).json

  const refused = await apiFetch(page, 'POST', '/api/workouts/sessions', { copyFromId: 2147483647, performedOn: todayDate() })
  expect(refused.status).toBe(409)
  await finish(page, open.id)
})

test('a start queued behind a held routine lock serialises with a sibling delete and renumber', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a, b] = days(routine)
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: b })

  const lock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const started = apiFetch(page, 'POST', '/api/workouts/sessions', { routineDayId: a, performedOn: todayDate() })
  try {
    await lock.waitForBlocked(1)
    await lock.client.query('delete from app.workout_templates where id = $1', [b])
    await lock.client.query('update app.workout_templates set description = $2 where id = $1', [a, 'renamed'])
  } finally {
    await lock.release()
  }

  expect((await started).status).toBe(200)
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(days(routine)[2])
  await finish(page, ((await apiFetch<WorkoutSession>(page, 'GET', '/api/workouts/sessions/active')).json).id)
})

test('a routine deleted while its start waits answers 404, not a deadlock', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a] = days(routine)

  const lock = await holdLocks('delete from app.routines where id = $1', [routine.id])
  const started = apiFetch(page, 'POST', '/api/workouts/sessions', { routineDayId: a, performedOn: todayDate() })
  try {
    await lock.waitForBlocked(1)
  } finally {
    await lock.release()
  }

  expect((await started).status).toBe(404)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).status).toBe(204)
})

// Parks the start on the open-workout index, after it has read the days and before it writes, so a day delete can race it.
async function raceStartWithDayDelete(page: Parameters<typeof apiFetch>[0], email: string, start: object, deleteDayId: number) {
  const blocker = await holdLocks(
    'insert into app.workout_sessions (user_id, performed_on) select id, current_date from app.users where email = $1',
    [email]
  )
  const started = apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), ...start })
  let deleted: ReturnType<typeof apiFetch> | undefined
  try {
    await blocker.waitForBlocked(1)
    deleted = apiFetch(page, 'DELETE', `/api/workouts/routine-days/${deleteDayId}`)
    const deleteState = { settled: false }
    const markSettled = () => {
      deleteState.settled = true
    }
    void deleted.then(markSettled, markSettled)
    // A deleter that skips the routine lock never queues; it finishes, and the start then trips over the gone day.
    await expect.poll(async () => deleteState.settled || await blocker.queued() >= 2).toBe(true)
  } finally {
    await blocker.release({ rollback: true })
  }
  return { started: await started, deleted: await deleted! }
}

test('deleting the due day while its start runs waits for the start instead of deadlocking', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a, b, c] = days(routine)
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: a })

  const { started, deleted } = await raceStartWithDayDelete(page, user.email, { routineDayId: a }, a)
  expect([started.status, deleted.status]).toEqual([200, 200])
  const after = await getRoutine(page, routine.id)
  expect(after.days.map((d) => d.id)).toEqual([b, c])
  expect(after.nextDayId).toBe(b)
  await finish(page, started.json.id)
})

test('deleting an off-order day while its start runs waits for the start instead of failing it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a, b, c] = days(routine)
  await apiFetch(page, 'PATCH', `/api/workouts/routines/${routine.id}`, { nextDayId: b })

  const { started, deleted } = await raceStartWithDayDelete(page, user.email, { routineDayId: a, pointer: 'keep' }, a)
  expect([started.status, deleted.status]).toEqual([200, 200])
  const after = await getRoutine(page, routine.id)
  expect(after.days.map((d) => d.id)).toEqual([b, c])
  expect(after.nextDayId).toBe(b)
  await finish(page, started.json.id)
})

test('deleting the day a start advances to waits for the start instead of failing it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const user = await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a, b, c] = days(routine)

  const { started, deleted } = await raceStartWithDayDelete(page, user.email, { routineDayId: a }, b)
  expect([started.status, deleted.status]).toEqual([200, 200])
  const after = await getRoutine(page, routine.id)
  expect(after.days.map((d) => d.id)).toEqual([a, c])
  expect(after.nextDayId).toBe(a)
  await finish(page, started.json.id)
})

test('a skip queued behind a start moves on from the pointer the start advanced', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routine = await threeDayRoutine(page)
  const [a, , c] = days(routine)

  const lock = await holdLocks('select id from app.routines where id = $1 for update', [routine.id])
  const started = apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: a, performedOn: todayDate() })
  let skipped: ReturnType<typeof apiFetch> | undefined
  try {
    await lock.waitForBlocked(1)
    skipped = apiFetch(page, 'POST', `/api/workouts/routines/${routine.id}/skip`)
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }

  expect([(await started).status, (await skipped!).status]).toEqual([200, 200])
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(c)
  await finish(page, (await started).json.id)
})

test('a routine delete and a start on it serialise either way round', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const first = await threeDayRoutine(page)
  let lock = await holdLocks('select id from app.routines where id = $1 for update', [first.id])
  const started = apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: days(first)[0], performedOn: todayDate() })
  let removed: ReturnType<typeof apiFetch> | undefined
  try {
    await lock.waitForBlocked(1)
    removed = apiFetch(page, 'DELETE', `/api/workouts/routines/${first.id}`)
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }
  expect([(await started).status, (await removed!).status]).toEqual([200, 200])
  expect((await apiFetch(page, 'GET', `/api/workouts/routines/${first.id}`)).status).toBe(404)
  await finish(page, (await started).json.id)

  const second = await threeDayRoutine(page)
  lock = await holdLocks('select id from app.routines where id = $1 for update', [second.id])
  removed = apiFetch(page, 'DELETE', `/api/workouts/routines/${second.id}`)
  let late: ReturnType<typeof apiFetch> | undefined
  try {
    await lock.waitForBlocked(1)
    late = apiFetch(page, 'POST', '/api/workouts/sessions', { routineDayId: days(second)[0], performedOn: todayDate() })
    await lock.waitForBlocked(2)
  } finally {
    await lock.release()
  }
  expect([(await removed).status, (await late!).status]).toEqual([200, 404])
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).status).toBe(204)
})

test('a copy whose exercise changed tracking type keeps the set count but not the old range', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const source = await adHocWorkout(page, 1)
  const entry = source.entries[0]!
  for (const reps of [8, 6]) await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 100, reps })
  await finish(page, source.id)
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${entry.exerciseId}/prefs`, { trackingType: 'weight_time' })

  const copy = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { copyFromId: source.id, performedOn: todayDate() })).json
  expect(copy.entries[0]).toMatchObject({ trackingType: 'weight_time', target: { sets: 2, low: null, high: null, weight: null } })
  await finish(page, copy.id)
})

test('a pointer choice without a routine day is refused', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const refused = await apiFetch(page, 'POST', '/api/workouts/sessions', { pointer: 'skip', performedOn: todayDate() })
  expect(refused.status).toBe(400)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).status).toBe(204)
})

test('a start without the local date is refused instead of dated in UTC', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const undated = { name: 'No date' }
  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', undated)).status).toBe(400)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).status).toBe(204)
})

test('copying skips an exercise deleted since, and a missing or foreign source is not found', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [keep, gone] = [await customExercise(page), await customExercise(page)]
  let source = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-04-06' })).json
  for (const exercise of [keep, gone]) {
    source = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${source.id}/entries`, { exerciseId: exercise.id })).json
  }
  await finish(page, source.id)
  await apiFetch(page, 'DELETE', `/api/workouts/exercises/${gone.id}`)

  const copy = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { copyFromId: source.id, performedOn: '2026-04-07' })
  expect(copy.status).toBe(200)
  expect(copy.json.entries.map((e) => e.exerciseId)).toEqual([keep.id])
  await finish(page, copy.json.id)

  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { copyFromId: 99999999, performedOn: '2026-04-07' })).status).toBe(404)
  await registerViaApi(page, makeUser())
  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { copyFromId: source.id, performedOn: '2026-04-07' })).status).toBe(404)
  expect((await apiFetch(page, 'GET', '/api/workouts/sessions/active')).json).toBeNull()
})
