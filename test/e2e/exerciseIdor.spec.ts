import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise } from '../../shared/types/workout'

interface Reference {
  categories: { id: number; key: string }[]
}
interface VariationGroup {
  id: number
  name: string
  exerciseIds: number[]
}

test('another user cannot reach a private exercise or variation group', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Private Curl ')
  const core = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json.categories.find(
    (c) => c.key === 'core'
  )!
  const mine = (
    await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
      name,
      categoryId: core.id,
      trackingType: 'weight_reps'
    })
  ).json
  const group = (
    await apiFetch<VariationGroup>(page, 'POST', '/api/workouts/variations', {
      name: `${name}Group`,
      exerciseIds: [mine.id]
    })
  ).json

  const exerciseUrl = `/api/workouts/exercises/${mine.id}`
  const groupUrl = `/api/workouts/variations/${group.id}`
  const listUrl = `/api/workouts/exercises?q=${encodeURIComponent(name)}`

  // Positive controls: the owner gets 200 on the same routes and payloads, so the intruder's 404s can't pass vacuously.
  expect((await apiFetch(page, 'GET', exerciseUrl)).status).toBe(200)
  expect((await apiFetch(page, 'PUT', `${exerciseUrl}/prefs`, { notes: 'mine now' })).status).toBe(200)
  expect((await apiFetch(page, 'PUT', `${exerciseUrl}/prefs`, { notes: null })).status).toBe(200)
  expect((await apiFetch(page, 'PUT', `${exerciseUrl}/favorite`)).status).toBe(200)
  expect((await apiFetch(page, 'DELETE', `${exerciseUrl}/favorite`)).status).toBe(200)
  expect((await apiFetch(page, 'PUT', `${exerciseUrl}/hidden`)).status).toBe(200)
  expect((await apiFetch(page, 'DELETE', `${exerciseUrl}/hidden`)).status).toBe(200)
  // The owner can't fork their own exercise; the 403 still shows the route found the row the intruder gets 404 for.
  const ownFork = await apiFetch<{ statusMessage: string }>(page, 'POST', `${exerciseUrl}/fork`)
  expect([ownFork.status, ownFork.json.statusMessage]).toEqual([403, 'Your own exercises can be edited directly'])
  const ownerListed = (await apiFetch<Exercise[]>(page, 'GET', listUrl)).json
  expect(ownerListed.some((e) => e.id === mine.id)).toBe(true)
  expect((await apiFetch(page, 'PATCH', groupUrl, { name: 'Taken' })).status).toBe(200)
  expect((await apiFetch(page, 'PATCH', groupUrl, { name: `${name}Group` })).status).toBe(200)
  const spare = await apiFetch<VariationGroup>(page, 'POST', '/api/workouts/variations', {
    name: uniquePrefix('Grab '),
    exerciseIds: [mine.id]
  })
  expect(spare.status).toBe(200)
  expect((await apiFetch(page, 'PATCH', groupUrl, { addExerciseIds: [mine.id] })).status).toBe(200)
  expect((await apiFetch(page, 'DELETE', `/api/workouts/variations/${spare.json.id}`)).status).toBe(200)

  const other = await browser.newContext()
  try {
    const intruder = await other.newPage()
    await intruder.goto(page.url())
    await registerViaApi(intruder, makeUser())

    expect((await apiFetch(intruder, 'GET', exerciseUrl)).status).toBe(404)
    expect((await apiFetch(intruder, 'PUT', `${exerciseUrl}/prefs`, { notes: 'mine now' })).status).toBe(404)
    expect((await apiFetch(intruder, 'PUT', `${exerciseUrl}/favorite`)).status).toBe(404)
    expect((await apiFetch(intruder, 'PUT', `${exerciseUrl}/hidden`)).status).toBe(404)
    expect((await apiFetch(intruder, 'POST', `${exerciseUrl}/fork`)).status).toBe(404)
    const listed = (await apiFetch<Exercise[]>(intruder, 'GET', listUrl)).json
    expect(listed.some((e) => e.id === mine.id)).toBe(false)

    expect((await apiFetch(intruder, 'PATCH', groupUrl, { name: 'Taken' })).status).toBe(404)
    expect((await apiFetch(intruder, 'DELETE', groupUrl)).status).toBe(404)
    const grab = await apiFetch(intruder, 'POST', '/api/workouts/variations', {
      name: uniquePrefix('Grab '),
      exerciseIds: [mine.id]
    })
    expect(grab.status).toBe(404)
    const own = (
      await apiFetch<VariationGroup>(intruder, 'POST', '/api/workouts/variations', {
        name: uniquePrefix('Own '),
        exerciseIds: []
      })
    ).json
    const added = await apiFetch(intruder, 'PATCH', `/api/workouts/variations/${own.id}`, { addExerciseIds: [mine.id] })
    expect(added.status).toBe(404)
    const theirGroups = (await apiFetch<VariationGroup[]>(intruder, 'GET', '/api/workouts/variations')).json
    expect(theirGroups.some((g) => g.id === group.id)).toBe(false)
  } finally {
    await other.close()
  }

  const groups = (await apiFetch<VariationGroup[]>(page, 'GET', '/api/workouts/variations')).json
  expect(groups.find((g) => g.id === group.id)).toEqual({ id: group.id, name: `${name}Group`, exerciseIds: [mine.id] })
  const detail = (await apiFetch<Exercise>(page, 'GET', exerciseUrl)).json
  expect(detail.notes).toBeNull()
  expect(detail.favorite).toBe(false)
  expect(detail.hidden).toBe(false)
})
