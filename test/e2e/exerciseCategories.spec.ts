import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise, ExerciseCategory } from '../../shared/types/workout'

interface VariationGroup { id: number, name: string, exerciseIds: number[] }
type ExerciseWithVariations = Exercise & { variations: { id: number, name: string }[] }

test('categories and variation groups', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Olympic ')

  const shared = (await apiFetch<ExerciseCategory[]>(page, 'GET', '/api/workouts/categories')).json
  expect(shared).toHaveLength(8)
  expect(shared.every((c) => c.shared)).toBe(true)

  const chest = shared.find((c) => c.key === 'chest')!
  const renamed = await apiFetch<ExerciseCategory>(page, 'PATCH', `/api/workouts/categories/${chest.id}`, {
    name: 'Pecs', color: 'pink'
  })
  expect(renamed.json.name).toBe('Pecs')
  expect(renamed.json.shared).toBe(true)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/categories/${chest.id}`)).status).toBe(403)

  await apiFetch(page, 'PATCH', `/api/workouts/categories/${chest.id}`, { hidden: true })
  const visible = (await apiFetch<ExerciseCategory[]>(page, 'GET', '/api/workouts/categories')).json
  expect(visible.some((c) => c.id === chest.id)).toBe(false)
  const chestUrl = `/api/workouts/exercises?categoryId=${chest.id}`
  const chestExercises = (await apiFetch<Exercise[]>(page, 'GET', chestUrl)).json
  expect(chestExercises.length).toBeGreaterThan(0)
  await apiFetch(page, 'PATCH', `/api/workouts/categories/${chest.id}`, { hidden: false })

  const mine = await apiFetch<ExerciseCategory>(page, 'POST', '/api/workouts/categories', { name, color: 'lime' })
  expect(mine.json.shared).toBe(false)
  const dupe = await apiFetch(page, 'POST', '/api/workouts/categories', { name: name.toLowerCase(), color: 'lime' })
  expect(dupe.status).toBe(409)

  const lift = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=clean')).json[0]!
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${lift.id}/prefs`, { categoryId: mine.json.id })
  const inMine = (await apiFetch<Exercise[]>(page, 'GET', `/api/workouts/exercises?categoryId=${mine.json.id}`)).json
  expect(inMine.some((e) => e.id === lift.id)).toBe(true)

  const back = shared.find((c) => c.key === 'back')!
  const selfMove = await apiFetch(page, 'DELETE', `/api/workouts/categories/${mine.json.id}?moveTo=${mine.json.id}`)
  expect(selfMove.status).toBe(400)
  const removed = await apiFetch(page, 'DELETE', `/api/workouts/categories/${mine.json.id}?moveTo=${back.id}`)
  expect(removed.json).toEqual({ ok: true })
  const inBack = (await apiFetch<Exercise[]>(page, 'GET', `/api/workouts/exercises?categoryId=${back.id}`)).json
  expect(inBack.some((e) => e.id === lift.id)).toBe(true)

  const benches = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=bench%20press')).json.slice(0, 2)
  const group = await apiFetch<VariationGroup>(page, 'POST', '/api/workouts/variations', {
    name: `${name}Bench`, exerciseIds: benches.map((e) => e.id)
  })
  expect(group.json.exerciseIds).toHaveLength(2)

  const detailUrl = `/api/workouts/exercises/${benches[0]!.id}`
  const detail = (await apiFetch<ExerciseWithVariations>(page, 'GET', detailUrl)).json
  expect(detail.variations.map((v) => v.id)).toContain(benches[1]!.id)

  const other = await apiFetch<{ id: number }>(page, 'POST', '/api/workouts/variations', {
    name: `${name}Other`, exerciseIds: []
  })
  const moved = await apiFetch<{ exerciseIds: number[] }>(page, 'PATCH', `/api/workouts/variations/${other.json.id}`, {
    addExerciseIds: [benches[0]!.id, benches[0]!.id]
  })
  expect(moved.status).toBe(200)
  expect(moved.json.exerciseIds).toEqual([benches[0]!.id])
  const groups = (await apiFetch<VariationGroup[]>(page, 'GET', '/api/workouts/variations')).json
  const first = groups.find((g) => g.id === group.json.id)!
  expect(first.exerciseIds).toEqual([benches[1]!.id])

  const custom = await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: `${name}Custom`, categoryId: back.id, trackingType: 'weight_reps'
  })
  await apiFetch(page, 'PATCH', `/api/workouts/variations/${group.json.id}`, { addExerciseIds: [custom.json.id] })
  const groupsWith = (await apiFetch<VariationGroup[]>(page, 'GET', '/api/workouts/variations')).json
  expect(groupsWith.find((g) => g.id === group.json.id)!.exerciseIds).toContain(custom.json.id)

  expect((await apiFetch(page, 'DELETE', `/api/workouts/exercises/${custom.json.id}`)).json).toEqual({ ok: true })
  const groupsAfter = (await apiFetch<VariationGroup[]>(page, 'GET', '/api/workouts/variations')).json
  expect(groupsAfter.find((g) => g.id === group.json.id)!.exerciseIds).not.toContain(custom.json.id)

  expect((await apiFetch(page, 'DELETE', `/api/workouts/variations/${group.json.id}`)).json).toEqual({ ok: true })
})
