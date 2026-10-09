import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise } from '../../shared/types/workout'

interface Reference {
  categories: { id: number; key: string }[]
}

test('exercise writes: custom exercises, prefs, favourite, hide, fork', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Cable Twist ')

  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const core = reference.categories.find((c) => c.key === 'core')!

  const created = await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name,
    categoryId: core.id,
    trackingType: 'weight_reps',
    loadStyle: 'plain',
    equipment: ['cable'],
    primaryMuscles: ['abdominals'],
    secondaryMuscles: []
  })
  expect(created.status).toBe(200)
  expect(created.json.shared).toBe(false)
  const mine = created.json.id

  const dupe = await apiFetch(page, 'POST', '/api/workouts/exercises', {
    name: name.toLowerCase(),
    categoryId: core.id,
    trackingType: 'reps'
  })
  expect(dupe.status).toBe(409)

  const renamed = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${mine}`, { name: `${name} v2` })
  expect(renamed.json.name).toBe(`${name} v2`)

  const ghostCategory = await apiFetch(page, 'POST', '/api/workouts/exercises', {
    name: `${name} ghost`,
    categoryId: 99999999,
    trackingType: 'reps'
  })
  expect(ghostCategory.status).toBe(404)

  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(page.url())
  await registerViaApi(otherPage, makeUser())
  const theirs = await apiFetch<{ id: number }>(otherPage, 'POST', '/api/workouts/categories', {
    name: uniquePrefix('Theirs '),
    color: 'lime'
  })
  const stolen = await apiFetch(page, 'POST', '/api/workouts/exercises', {
    name: `${name} stolen`,
    categoryId: theirs.json.id,
    trackingType: 'reps'
  })
  expect(stolen.status).toBe(404)
  const stolenMove = await apiFetch(page, 'PUT', `/api/workouts/exercises/${mine}`, { categoryId: theirs.json.id })
  expect(stolenMove.status).toBe(404)
  const stolenPref = await apiFetch(page, 'PUT', `/api/workouts/exercises/${mine}/prefs`, {
    categoryId: theirs.json.id
  })
  expect(stolenPref.status).toBe(404)
  await other.close()
  const ghostPref = await apiFetch(page, 'PUT', `/api/workouts/exercises/${mine}/prefs`, { categoryId: 99999999 })
  expect(ghostPref.status).toBe(404)
  const forkOwn = await apiFetch<{ statusMessage: string }>(page, 'POST', `/api/workouts/exercises/${mine}/fork`)
  expect(forkOwn.status).toBe(403)
  expect(forkOwn.json.statusMessage).toBe('Your own exercises can be edited directly')

  const benchHits = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json
  const shared = benchHits.find((e) => e.shared)!
  expect((await apiFetch(page, 'PUT', `/api/workouts/exercises/${shared.id}`, { name: 'Nope' })).status).toBe(403)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/exercises/${shared.id}`)).status).toBe(403)

  const prefs = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${shared.id}/prefs`, {
    barWeight: 35,
    restSeconds: 180,
    weightIncrement: 2.5,
    notes: 'Mid grip',
    loadStyle: 'assisted'
  })
  expect(prefs.json.barWeight).toBe(null)
  expect(prefs.json.loadStyle).toBe('assisted')
  expect(prefs.json.restSeconds).toBe(180)
  expect(prefs.json.overridden.loadStyle).toBe(true)

  const reset = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${shared.id}/prefs`, {
    loadStyle: null,
    barWeight: null
  })
  expect(reset.json.loadStyle).toBe('barbell')
  expect(reset.json.barWeight).toBe(45)

  const favOn = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${shared.id}/favorite`)
  expect(favOn.json.favorite).toBe(true)
  const favFirst = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=bench')).json
  expect(favFirst[0]!.id).toBe(shared.id)
  const favOff = await apiFetch<Exercise>(page, 'DELETE', `/api/workouts/exercises/${shared.id}/favorite`)
  expect(favOff.json.favorite).toBe(false)

  await apiFetch(page, 'PUT', `/api/workouts/exercises/${shared.id}/hidden`)
  const visible = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises')).json
  expect(visible.some((e) => e.id === shared.id)).toBe(false)
  const withHidden = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?includeHidden=1')).json
  expect(withHidden.some((e) => e.id === shared.id)).toBe(true)
  await apiFetch(page, 'DELETE', `/api/workouts/exercises/${shared.id}/hidden`)

  const forked = await apiFetch<Exercise>(page, 'POST', `/api/workouts/exercises/${shared.id}/fork`)
  expect(forked.json.shared).toBe(false)
  expect(forked.json.name).toBe(shared.name)
  const afterFork = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json
  expect(afterFork.filter((e) => e.name === shared.name)).toHaveLength(1)
  expect(afterFork.find((e) => e.name === shared.name)!.shared).toBe(false)

  expect((await apiFetch(page, 'DELETE', `/api/workouts/exercises/${mine}`)).json).toEqual({ ok: true })
  const afterDelete = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises')).json
  expect(afterDelete.some((e) => e.id === mine)).toBe(false)
})
