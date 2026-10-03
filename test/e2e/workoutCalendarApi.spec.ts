import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise, ExerciseCategory, WorkoutSession, WorkoutSessionSummary } from '../../shared/types/workout'

async function categories(page: Page) {
  return (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json.categories
}

async function makeExercise(page: Page, categoryId: number, loadStyle: 'plain' | 'assisted' = 'plain') {
  return (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Cal '), categoryId, trackingType: 'weight_reps', loadStyle
  })).json
}

async function logWorkout(page: Page, performedOn: string, sets: { exerciseId: number, weight: number, reps: number }[]) {
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
  for (const { exerciseId, weight, reps } of sets) {
    const entries = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId })).json.entries
    await apiFetch(page, 'POST', `/api/workouts/entries/${entries.at(-1)!.id}/sets`, { weight, reps })
  }
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  return session.id
}

const list = async (page: Page, query: string) =>
  (await apiFetch<WorkoutSessionSummary[]>(page, 'GET', `/api/workouts/sessions?limit=100&${query}`))

test('sessions list: category any/all, exercise thresholds, dates and category dots', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cats = await categories(page)
  const chest = cats.find((c) => c.key === 'chest')!
  const back = cats.find((c) => c.key === 'back')!
  const legs = cats.find((c) => c.key === 'legs')!
  const press = await makeExercise(page, chest.id)
  const row = await makeExercise(page, back.id)
  const dip = await makeExercise(page, chest.id, 'assisted')

  const both = await logWorkout(page, '2026-03-02', [{ exerciseId: press.id, weight: 225, reps: 5 }, { exerciseId: row.id, weight: 135, reps: 8 }])
  const chestOnly = await logWorkout(page, '2026-03-04', [{ exerciseId: press.id, weight: 225, reps: 4 }])
  const assisted = await logWorkout(page, '2026-03-06', [{ exerciseId: dip.id, weight: 20, reps: 8 }])
  const empty = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-03-08' })).json.id
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${empty}`, { finish: true })

  const ids = async (query: string) => (await list(page, query)).json.map((s) => s.id).sort()

  expect(await ids(`categories=${chest.id},${back.id}`)).toEqual([both, chestOnly, assisted].sort())
  expect(await ids(`categories=${chest.id},${back.id}&match=all`)).toEqual([both])
  expect(await ids(`categories=${legs.id}`)).toEqual([])
  expect(await ids('categories=999999')).toEqual([])

  expect(await ids(`exerciseId=${press.id}`)).toEqual([both, chestOnly].sort())
  expect(await ids(`exerciseId=${press.id}&minWeight=225&minReps=5`)).toEqual([both])
  expect(await ids(`exerciseId=${press.id}&minWeight=225.5`)).toEqual([])
  expect(await ids(`exerciseId=${dip.id}&minWeight=20`)).toEqual([assisted])
  expect(await ids(`exerciseId=${dip.id}&minWeight=10`)).toEqual([])
  expect(await ids(`categories=${back.id}&exerciseId=${press.id}`)).toEqual([both])

  expect(await ids('from=2026-03-03&to=2026-03-06')).toEqual([chestOnly, assisted].sort())

  const summaries = (await list(page, 'from=2026-03-01&to=2026-03-31')).json
  expect(summaries.find((s) => s.id === both)!.categories).toEqual([
    { id: chest.id, color: chest.color }, { id: back.id, color: back.color }
  ])
  expect(summaries.find((s) => s.id === empty)!.categories).toEqual([])

  await apiFetch(page, 'PATCH', `/api/workouts/categories/${chest.id}`, { color: 'indigo' })
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${row.id}/prefs`, { categoryId: legs.id })
  const recoloured = (await list(page, 'from=2026-03-02&to=2026-03-02')).json[0]!
  expect(recoloured.categories).toEqual([{ id: chest.id, color: 'indigo' }, { id: legs.id, color: legs.color }])
  expect(await ids(`categories=${legs.id}`)).toEqual([both])

  expect((await list(page, 'minReps=5')).status).toBe(400)
  expect((await list(page, 'from=2026-04-01&to=2026-03-01')).status).toBe(400)
})

async function download(page: Page, query: string) {
  return page.evaluate(async (path) => {
    const res = await fetch(path)
    return { status: res.status, type: res.headers.get('content-type'), disposition: res.headers.get('content-disposition'), text: await res.text() }
  }, `/api/workouts/sessions/export?${query}`)
}

test('export: one row per set in date order under the filter, assisted negative, escaped names', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cats = await categories(page)
  const chest = cats.find((c) => c.key === 'chest')!
  const back = cats.find((c) => c.key === 'back')!
  const press = await makeExercise(page, chest.id)
  const dip = await makeExercise(page, chest.id, 'assisted')
  const row = await makeExercise(page, back.id)

  await logWorkout(page, '2026-05-10', [{ exerciseId: press.id, weight: 185, reps: 8 }])
  const earlier = await logWorkout(page, '2026-05-03', [{ exerciseId: dip.id, weight: 20, reps: 6 }])
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${earlier}`, { name: 'Pull, "heavy"', notes: 'good day' })
  await logWorkout(page, '2026-05-05', [{ exerciseId: row.id, weight: 135, reps: 10 }])

  const multi = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-05-12' })).json
  const entryIds: number[] = []
  for (const ex of [press, press]) {
    const made = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${multi.id}/entries`, { exerciseId: ex.id })).json.entries
    entryIds.push(made.at(-1)!.id)
  }
  await apiFetch(page, 'POST', `/api/workouts/entries/${entryIds[0]}/sets`, { weight: 100, reps: 5 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entryIds[0]}/sets`, { weight: 105, reps: 4 })
  await apiFetch(page, 'POST', `/api/workouts/entries/${entryIds[1]}/sets`, { weight: 90, reps: 8 })
  await apiFetch(page, 'POST', `/api/workouts/sessions/${multi.id}/group`, { entryIds })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${multi.id}`, { finish: true })

  const res = await download(page, `categories=${chest.id}`)
  expect(res.status).toBe(200)
  expect(res.type).toContain('text/csv')
  expect(res.disposition).toBe('attachment; filename="workouts-start-to-latest.csv"')
  const lines = res.text.split('\n')
  expect(lines[0]).toBe('Date,Workout,Exercise,Category,Set,Weight,Weight unit,Reps,Distance,Distance unit,Duration (s),Superset,Comment,Workout comment')
  expect(lines.slice(1)).toEqual([
    `2026-05-03,"Pull, ""heavy""",${dip.name},Chest,1,-20,lb,6,,,,,,good day`,
    `2026-05-10,Workout,${press.name},Chest,1,185,lb,8,,,,,,`,
    `2026-05-12,Workout,${press.name},Chest,1,100,lb,5,,,,A1,,`,
    `2026-05-12,Workout,${press.name},Chest,2,105,lb,4,,,,A1,,`,
    `2026-05-12,Workout,${press.name},Chest,1,90,lb,8,,,,A2,,`
  ])

  const ranged = await download(page, 'from=2026-05-04&to=2026-05-09')
  expect(ranged.disposition).toBe('attachment; filename="workouts-2026-05-04-to-2026-05-09.csv"')
  expect(ranged.text.split('\n')).toHaveLength(2)
  expect((await download(page, 'minReps=3')).status).toBe(400)
})
