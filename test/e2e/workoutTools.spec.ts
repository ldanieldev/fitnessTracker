import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'
import type { Exercise, OneRepMaxResult, WorkoutSession } from '../../shared/types/workout'

async function barbellPair(page: Parameters<typeof apiFetch>[0]) {
  const list = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell')).json
  const barbells = list.filter((exercise) => exercise.loadStyle === 'barbell' && exercise.barWeight != null)
  expect(barbells.length).toBeGreaterThanOrEqual(2)
  return [barbells[0]!, barbells[1]!] as const
}

test('plate override and rest time reach the workout entry', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [rack, other] = await barbellPair(page)

  const alone = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${rack.id}/prefs`, {
    plateSizes: [55, 45]
  })
  expect(alone.json.plateSizes).toEqual([55, 45])
  expect((await apiFetch<Exercise>(page, 'GET', `/api/workouts/exercises/${rack.id}`)).json.plateSizes).toEqual([55, 45])

  const prefs = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${rack.id}/prefs`, {
    plateSizes: [2.5, 55, 45, 25, 10, 5], restSeconds: 150
  })
  expect(prefs.status).toBe(200)
  expect(prefs.json.plateSizes).toEqual([55, 45, 25, 10, 5, 2.5])
  expect((await apiFetch(page, 'PUT', `/api/workouts/exercises/${rack.id}/prefs`, { plateSizes: [] })).status).toBe(400)

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  await apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId: rack.id })
  const withBoth = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: other.id
  })).json
  const [rackEntry, otherEntry] = withBoth.entries
  expect(rackEntry!.plateSizes).toEqual([55, 45, 25, 10, 5, 2.5])
  expect(rackEntry!.restSeconds).toBe(150)
  expect(otherEntry!.plateSizes).toEqual([45, 35, 25, 10, 5, 2.5])
  expect(otherEntry!.restSeconds).toBeNull()

  const reset = await apiFetch<Exercise>(page, 'PUT', `/api/workouts/exercises/${rack.id}/prefs`, { plateSizes: null })
  expect(reset.json.plateSizes).toBeNull()
})

test('1RM estimate comes from recent sets and follows edits', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [lift] = await barbellPair(page)
  const today = new Date().toISOString().slice(0, 10)
  const url = `/api/workouts/exercises/${lift.id}/one-rep-max?on=${today}`

  expect((await apiFetch<OneRepMaxResult>(page, 'GET', url)).json).toEqual({ estimate: null, source: null, assisted: false })

  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: today })).json
  const entryId = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: lift.id
  })).json.entries[0]!.id
  const logged = await apiFetch<{ set: { id: number } }>(page, 'POST', `/api/workouts/entries/${entryId}/sets`, {
    weight: 225, reps: 5
  })

  const first = (await apiFetch<OneRepMaxResult>(page, 'GET', url)).json
  expect(first).toEqual({ estimate: 253.1, source: { weight: 225, reps: 5, performedOn: today }, assisted: false })

  await apiFetch(page, 'PATCH', `/api/workouts/sets/${logged.json.set.id}`, { weight: 245 })
  expect((await apiFetch<OneRepMaxResult>(page, 'GET', url)).json.estimate).toBe(275.6)

  // Before the assisted PUT: the short-circuit would otherwise answer these without reaching the window or the query.
  expect((await apiFetch(page, 'GET', `/api/workouts/exercises/${lift.id}/one-rep-max?on=yesterday`)).status).toBe(400)
  expect((await apiFetch(page, 'GET', `/api/workouts/exercises/${lift.id}/one-rep-max?on=2026-02-30`)).status).toBe(400)

  await apiFetch(page, 'PUT', `/api/workouts/exercises/${lift.id}/prefs`, { loadStyle: 'assisted' })
  expect((await apiFetch<OneRepMaxResult>(page, 'GET', url)).json).toEqual({ estimate: null, source: null, assisted: true })

  expect((await apiFetch(page, 'GET', `/api/workouts/exercises/99999999/one-rep-max?on=${today}`)).status).toBe(404)
})

test('tools sheet loads the rack exercise with its own plates', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [rack, other] = await barbellPair(page)
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${rack.id}/prefs`, { plateSizes: [55, 45, 25, 10, 5, 2.5] })
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', {})).json
  await apiFetch(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId: rack.id })
  const entries = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: other.id
  })).json.entries
  const [rackEntry, otherEntry] = entries

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await page.locator(`[data-test="entry-plates-${rackEntry!.id}"]`).click()
  const rackTarget = String(rackEntry!.barWeight! + 270)
  await page.locator('[data-test="tools-target"]').fill(rackTarget)
  await expect(page.locator('[data-test="plates-each-side"]')).toHaveText('Each side: 55 · 55 · 25')

  await page.locator('[data-test="plates-use"]').click()
  await expect(page.locator('[data-test="tools-sheet"]')).toHaveCount(0)
  const rackCard = page.locator(`[data-test="entry-card-${rackEntry!.id}"]`)
  await expect(rackCard.locator('[data-test="set-weight-new"]')).toHaveValue(rackTarget)

  await page.locator(`[data-test="entry-plates-${otherEntry!.id}"]`).click()
  await page.locator('[data-test="tools-target"]').fill(String(otherEntry!.barWeight! + 270))
  await expect(page.locator('[data-test="plates-each-side"]')).toHaveText('Each side: 45 · 45 · 45')

  await page.locator('[data-test="tools-tab-one-rep-max"]').click()
  await expect(page.locator('[data-test="one-rep-max-empty"]')).toBeVisible()
  await page.locator('[data-test="override-weight"]').fill('225')
  await page.locator('[data-test="override-reps"]').fill('5')
  await expect(page.locator('[data-test="one-rep-max-estimate"]')).toContainText('253.1')
  await page.locator('[data-test="tools-tab-set-calc"]').click()
  await expect(page.locator('[data-test="set-calc-loadable"]')).toBeVisible()
})
