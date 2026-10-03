import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Routine } from '../../shared/types/routine'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../shared/types/workout'

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

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
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
  let session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
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

  const started = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: a })
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

  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { routineDayId: c })).status).toBe(400)

  const kept = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: c, pointer: 'keep' })).json
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(a)
  await finish(page, kept.id)

  const floating = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: pump })).json
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(a)
  await finish(page, floating.id)

  const skipped = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: b, pointer: 'skip' })).json
  expect((await getRoutine(page, routine.id)).nextDayId).toBe(c)
  await finish(page, skipped.id)
})

test('409 leaves the pointer', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const { routine } = await routineWithDays(page)
  const [a] = days(routine)
  const open = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json

  const refused = await apiFetch<{ data: { session: WorkoutSession } }>(page, 'POST', '/api/workouts/sessions', { routineDayId: a })
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

  const started = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: days(routine)[0] })).json
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

  const copy = await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { copyFromId: source.id, entryIds: [a, c] })
  expect(copy.status).toBe(200)
  expect(copy.json.routineDayId).toBeNull()
  expect(copy.json.entries.map((e) => e.exerciseId)).toEqual([source.entries[0]!.exerciseId, source.entries[2]!.exerciseId])
  expect(copy.json.entries[0]!.target).toEqual({ sets: 3, low: 6, high: 8, weight: null })
  expect(copy.json.entries[1]!.target).toEqual({ sets: 1, low: 12, high: 12, weight: null })
  await finish(page, copy.json.id)

  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { copyFromId: source.id, entryIds: [999999] })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { entryIds: [b] })).status).toBe(400)
  expect((await apiFetch(page, 'POST', '/api/workouts/sessions', { copyFromId: source.id, routineDayId: 1 })).status).toBe(400)
})
