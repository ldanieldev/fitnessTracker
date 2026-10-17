import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { MeasurementType } from '../../shared/types/body'
import type { BodyweightTrend, Consistency, NutritionStreak, Strength } from '../../shared/types/dashboard'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../shared/types/workout'
import { shiftDate, todayDate } from '../../shared/utils/nutritionSummary'
import { weekStartOf } from '../../shared/utils/programs'

async function signUp(page: Page, weekStart: 0 | 1 = 1) {
  await registerViaApi(page, makeUser())
  const id = (await apiFetch<{ user: { id: number } }>(page, 'GET', '/api/_auth/session')).json.user.id
  await apiFetch(page, 'PUT', `/api/users/${id}`, { weekStart })
  return id
}

async function bodyweightId(page: Page) {
  const types = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json
  return types.find((t) => t.key === 'bodyweight')!.id
}

async function weighIn(page: Page, typeId: number, measuredOn: string, value: number) {
  return apiFetch<{ id: number }>(page, 'POST', '/api/body/entries', {
    typeId,
    value,
    measuredAt: `${measuredOn}T08:00:00.000Z`,
    measuredOn
  })
}

async function logMeal(page: Page, date: string) {
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  await apiFetch(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
    {
      entryType: 'quick_add',
      containerId: containers.json[0]!.id,
      description: 'Oats',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 400 }
    }
  ])
}

const get = <T>(page: Page, part: string, today?: string) =>
  apiFetch<T>(page, 'GET', `/api/dashboard/${part}${today ? `?today=${today}` : ''}`)

test('bodyweight: empty user has no trend', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const res = await get<BodyweightTrend>(page, 'bodyweight')
  expect(res.status).toBe(200)
  expect(res.json).toMatchObject({
    unit: 'lbs',
    current: null,
    latest: null,
    previous: null,
    change: null,
    series: [],
    daily: [],
    goal: null
  })
})

test('bodyweight: 7-day average, 4-week change, weekly series and goal', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  const typeId = await bodyweightId(page)
  await weighIn(page, typeId, shiftDate(today, -28), 185)
  await weighIn(page, typeId, shiftDate(today, -1), 181)
  await weighIn(page, typeId, today, 180)
  await apiFetch(page, 'PUT', `/api/body/types/${typeId}/goal`, { targetValue: 175 })
  const res = (await get<BodyweightTrend>(page, 'bodyweight')).json
  expect(res).toMatchObject({
    typeId,
    current: 180.5,
    change: -4.5,
    latest: { value: 180, date: today },
    previous: { value: 181, date: shiftDate(today, -1) },
    series: [185, 180.5],
    daily: [181, 180]
  })
  expect(res.goal!.targetValue).toBe(175)

  const entry = (await weighIn(page, typeId, shiftDate(today, -2), 176)).json
  expect((await get<BodyweightTrend>(page, 'bodyweight')).json.current).toBe(179)
  await apiFetch(page, 'DELETE', `/api/body/entries/${entry.id}`)
  expect((await get<BodyweightTrend>(page, 'bodyweight')).json.current).toBe(180.5)
})

test('bodyweight: out-of-window reading and goal edits bust the cache', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  const typeId = await bodyweightId(page)
  const old = shiftDate(today, -200)
  const entry = (await weighIn(page, typeId, old, 190)).json
  expect((await get<BodyweightTrend>(page, 'bodyweight')).json.latest).toEqual({ value: 190, date: old })
  await apiFetch(page, 'PATCH', `/api/body/entries/${entry.id}`, { value: 188 })
  expect((await get<BodyweightTrend>(page, 'bodyweight')).json.latest).toEqual({ value: 188, date: old })
  await apiFetch(page, 'PUT', `/api/body/types/${typeId}/goal`, { targetValue: 175 })
  expect((await get<BodyweightTrend>(page, 'bodyweight')).json.goal?.targetValue).toBe(175)
  await apiFetch(page, 'DELETE', `/api/body/types/${typeId}/goal`)
  expect((await get<BodyweightTrend>(page, 'bodyweight')).json.goal).toBeNull()
})

test('nutrition: day streak counts through yesterday and ignores notes-only days', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  for (const days of [2, 1, 5]) await logMeal(page, shiftDate(today, -days))
  await apiFetch(page, 'PUT', `/api/nutrition/diary/${shiftDate(today, -3)}/notes`, { notes: 'rest' })
  const res = (await get<NutritionStreak>(page, 'nutrition')).json
  expect(res).toMatchObject({ weekStart: 1, streak: 2, best: 2 })
  expect(res.days).toEqual([shiftDate(today, -5), shiftDate(today, -2), shiftDate(today, -1)])
  const lastWeekStart = shiftDate(weekStartOf(today, 1), -7)
  const thisWeekStart = weekStartOf(today, 1)
  const expected = [5, 2, 1].map((d) => shiftDate(today, -d)).filter((d) => d >= lastWeekStart && d < thisWeekStart)
  expect(res.lastWeek).toBe(expected.length)

  await logMeal(page, today)
  expect((await get<NutritionStreak>(page, 'nutrition')).json.streak).toBe(3)
})

test('hidden modules answer 204 and ?today is bounded', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const id = await signUp(page)
  await apiFetch(page, 'PUT', `/api/users/${id}`, { showBody: false, showNutrition: false })
  expect((await get(page, 'bodyweight')).status).toBe(204)
  expect((await get(page, 'nutrition')).status).toBe(204)
  await apiFetch(page, 'PUT', `/api/users/${id}`, { showBody: true })
  expect((await get(page, 'bodyweight', shiftDate(todayDate(), 2))).status).toBe(400)
  expect((await get(page, 'bodyweight', shiftDate(todayDate(), 1))).status).toBe(200)
})

async function makeExercise(page: Page, loadStyle: 'plain' | 'assisted' = 'plain') {
  const { categories } = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json
  return (
    await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
      name: uniquePrefix('Dash '),
      categoryId: categories[0]!.id,
      trackingType: 'weight_reps',
      loadStyle
    })
  ).json
}

async function logWorkout(
  page: Page,
  performedOn: string,
  sets: { exerciseId: number; weight: number; reps: number }[],
  finish = true
) {
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
  for (const { exerciseId, weight, reps } of sets) {
    const entries = (
      await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId })
    ).json.entries
    await apiFetch(page, 'POST', `/api/workouts/entries/${entries.at(-1)!.id}/sets`, { weight, reps })
  }
  if (finish) await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  return session.id
}

test('consistency: empty user', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const res = (await get<Consistency>(page, 'consistency')).json
  expect(res.weeks).toHaveLength(12)
  expect(res.weeks.every((w) => w.met === null && w.target === 3)).toBe(true)
  expect(res).toMatchObject({
    days: [],
    streak: 0,
    best: 0,
    thisWeek: { count: 0, target: 3 },
    targetSource: 'setting'
  })
})

test('consistency: weekly target from the setting, streaks and the in-progress week', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const id = await signUp(page, 1)
  await apiFetch(page, 'PUT', `/api/users/${id}`, { workoutsPerWeek: 2 })
  const today = todayDate()
  const thisWeek = weekStartOf(today, 1)
  const lastWeek = shiftDate(thisWeek, -7)
  const exercise = await makeExercise(page)
  const sets = [{ exerciseId: exercise.id, weight: 100, reps: 5 }]
  await logWorkout(page, lastWeek, sets)
  await logWorkout(page, shiftDate(lastWeek, 1), sets)
  await logWorkout(page, today, sets)

  let res = (await get<Consistency>(page, 'consistency')).json
  expect(res.weeks.at(-2)).toMatchObject({ start: lastWeek, count: 2, target: 2, met: true })
  expect(res.weeks.at(-1)).toMatchObject({ start: thisWeek, count: 1, target: 2, met: null })
  expect(res).toMatchObject({ streak: 1, best: 1, thisWeek: { count: 1, target: 2 }, targetSource: 'setting' })
  expect(res.days).toEqual([lastWeek, shiftDate(lastWeek, 1), today].sort())
  expect(res.weeks.at(-3)!.met).toBeNull()

  // count is distinct days, so the second workout must land on another day of this week when one exists.
  const second = shiftDate(today, -1) >= thisWeek ? shiftDate(today, -1) : today
  const open = await logWorkout(page, second, sets, false)
  expect((await get<Consistency>(page, 'consistency')).json.thisWeek.count).toBe(1)
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${open}`, { finish: true })
  res = (await get<Consistency>(page, 'consistency')).json
  if (second === today) {
    expect(res).toMatchObject({ thisWeek: { count: 1 }, streak: 1, best: 1 })
    expect(res.weeks.at(-1)!.met).toBeNull()
  } else {
    expect(res).toMatchObject({ thisWeek: { count: 2 }, streak: 2, best: 2 })
    expect(res.weeks.at(-1)!.met).toBe(true)
  }
})

test('consistency: hidden workouts module answers 204', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const id = await signUp(page)
  await apiFetch(page, 'PUT', `/api/users/${id}`, { showWorkouts: false })
  expect((await get(page, 'consistency')).status).toBe(204)
})

test('strength: goal lifts first, then most trained, assisted excluded', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  const goalLift = await makeExercise(page)
  const trained = await makeExercise(page)
  const assisted = await makeExercise(page, 'assisted')
  await logWorkout(page, shiftDate(today, -70), [{ exerciseId: goalLift.id, weight: 100, reps: 5 }])
  await logWorkout(page, shiftDate(today, -3), [{ exerciseId: goalLift.id, weight: 120, reps: 5 }])
  for (const days of [20, 10, 4]) {
    await logWorkout(page, shiftDate(today, -days), [
      { exerciseId: trained.id, weight: 80, reps: 8 },
      { exerciseId: assisted.id, weight: 40, reps: 8 }
    ])
  }
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${goalLift.id}/goal`, { metric: 'e1rm', targetValue: 200 })

  const { lifts } = (await get<Strength>(page, 'strength')).json
  expect(lifts.map((l) => l.exerciseId)).toEqual([goalLift.id, trained.id])
  const [goal, most] = lifts
  expect(goal).toMatchObject({ metric: 'e1rm', unit: 'lb', lowerIsBetter: false })
  expect(goal!.change).toBeGreaterThan(0)
  expect(goal!.goal).toMatchObject({ targetValue: 200, targetReps: null })
  expect(goal!.goal!.progress).toBeGreaterThan(0)
  expect(goal!.goal!.progress).toBeLessThan(1)
  expect(most).toMatchObject({ metric: 'e1rm', goal: null, change: null })
  expect(most!.series).toHaveLength(3)
})

test('strength: empty user and hidden module', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const id = await signUp(page)
  expect((await get<Strength>(page, 'strength')).json).toEqual({ lifts: [] })
  await apiFetch(page, 'PUT', `/api/users/${id}`, { showWorkouts: false })
  expect((await get(page, 'strength')).status).toBe(204)
})

test('strength: editing only targetReps busts the cache', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const today = todayDate()
  const lift = await makeExercise(page)
  await logWorkout(page, shiftDate(today, -6), [{ exerciseId: lift.id, weight: 100, reps: 5 }])
  await logWorkout(page, shiftDate(today, -2), [{ exerciseId: lift.id, weight: 110, reps: 3 }])
  const url = `/api/workouts/exercises/${lift.id}/goal`
  await apiFetch(page, 'PUT', url, { metric: 'weight_at_reps', targetValue: 200, targetReps: 5 })
  expect((await get<Strength>(page, 'strength')).json.lifts[0]).toMatchObject({ value: 100 })
  await apiFetch(page, 'PUT', url, { metric: 'weight_at_reps', targetValue: 200, targetReps: 3 })
  expect((await get<Strength>(page, 'strength')).json.lifts[0]).toMatchObject({ value: 110 })
})

test('strength: a rep-cap change busts the cache and falls back to max weight', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const id = await signUp(page)
  const lift = await makeExercise(page)
  await logWorkout(page, shiftDate(todayDate(), -2), [{ exerciseId: lift.id, weight: 200, reps: 8 }])
  const before = (await get<Strength>(page, 'strength')).json.lifts[0]
  expect(before).toMatchObject({ exerciseId: lift.id, metric: 'e1rm' })
  expect(before!.value).toBeGreaterThan(200)
  await apiFetch(page, 'PUT', `/api/users/${id}`, { oneRepMaxRepCap: 5 })
  expect((await get<Strength>(page, 'strength')).json.lifts[0]).toMatchObject({
    exerciseId: lift.id,
    metric: 'max_weight',
    value: 200
  })
})

test('strength: renaming or deleting a lift busts the cache', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const lift = await makeExercise(page)
  await logWorkout(page, shiftDate(todayDate(), -2), [{ exerciseId: lift.id, weight: 100, reps: 5 }])
  expect((await get<Strength>(page, 'strength')).json.lifts[0]).toMatchObject({ name: lift.name })
  const renamed = uniquePrefix('Renamed ')
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${lift.id}`, { name: renamed })
  expect((await get<Strength>(page, 'strength')).json.lifts[0]).toMatchObject({ name: renamed })
  await apiFetch(page, 'DELETE', `/api/workouts/exercises/${lift.id}`)
  expect((await get<Strength>(page, 'strength')).json.lifts).toEqual([])
})

test('strength: a goal without a measurable value leaves the lift to the most-trained fallback', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await signUp(page)
  const lift = await makeExercise(page)
  await logWorkout(page, shiftDate(todayDate(), -2), [{ exerciseId: lift.id, weight: 100, reps: 5 }])
  const url = `/api/workouts/exercises/${lift.id}/goal`
  await apiFetch(page, 'PUT', url, { metric: 'weight_at_reps', targetValue: 200, targetReps: 3 })
  expect((await get<Strength>(page, 'strength')).json.lifts).toEqual([
    expect.objectContaining({ exerciseId: lift.id, metric: 'e1rm', goal: null })
  ])
})

test('consistency: changing workouts per week busts the cache', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const id = await signUp(page)
  expect((await get<Consistency>(page, 'consistency')).json.thisWeek.target).toBe(3)
  await apiFetch(page, 'PUT', `/api/users/${id}`, { workoutsPerWeek: 5 })
  const res = (await get<Consistency>(page, 'consistency')).json
  expect(res.thisWeek.target).toBe(5)
  expect(res.weeks.every((w) => w.target === 5)).toBe(true)
})
