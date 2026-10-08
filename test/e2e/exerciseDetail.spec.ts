import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { Exercise, ExerciseDetail } from '../../shared/types/workout'

interface Reference { categories: { id: number, key: string }[] }

test('one exercise resolves visibility, prefs and hidden categories without the catalogue', async ({
  page, goto, browser
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const reference = (await apiFetch<Reference>(page, 'GET', '/api/workouts/reference')).json
  const core = reference.categories.find((c) => c.key === 'core')!
  const back = reference.categories.find((c) => c.key === 'back')!

  const mine = (await apiFetch<ExerciseDetail>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Detail '), categoryId: core.id, trackingType: 'reps'
  })).json
  expect(mine).toMatchObject({ shared: false, instructions: [], variations: [], category: { key: 'core' } })

  const hits = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json
  const shared = hits.find((e) => e.shared && e.loadStyle === 'barbell')!
  const prefs = { categoryId: back.id, loadStyle: 'assisted' }
  await apiFetch(page, 'PUT', `/api/workouts/exercises/${shared.id}/prefs`, prefs)
  await apiFetch(page, 'PATCH', `/api/workouts/categories/${back.id}`, { hidden: true })
  const detail = await apiFetch<ExerciseDetail>(page, 'GET', `/api/workouts/exercises/${shared.id}`)
  expect(detail.status).toBe(200)
  expect(detail.json.instructions.length).toBeGreaterThan(0)
  expect(detail.json.category).toMatchObject({ key: 'back', hidden: true })
  expect(detail.json.overridden.category).toBe(true)
  expect(detail.json.loadStyle).toBe('assisted')

  const oneRm = await apiFetch(page, 'GET', `/api/workouts/exercises/${shared.id}/one-rep-max?on=2026-01-05`)
  expect(oneRm.json).toEqual({ estimate: null, source: null, assisted: true })
  expect((await apiFetch(page, 'GET', `/api/workouts/exercises/${shared.id}/series?metric=e1rm`)).status).toBe(400)
  expect((await apiFetch(page, 'GET', `/api/workouts/exercises/${shared.id}/series?metric=max_weight`)).status)
    .toBe(200)

  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(page.url())
  await registerViaApi(otherPage, makeUser())
  for (const path of ['', '/one-rep-max?on=2026-01-05', '/series?metric=total_reps']) {
    expect((await apiFetch(otherPage, 'GET', `/api/workouts/exercises/${mine.id}${path}`)).status).toBe(404)
  }
  const theirView = (await apiFetch<ExerciseDetail>(otherPage, 'GET', `/api/workouts/exercises/${shared.id}`)).json
  expect(theirView.loadStyle).toBe('barbell')
  expect(theirView.overridden.category).toBe(false)
  expect(theirView.category.hidden).toBe(false)
  await other.close()
})

test('the about tab labels its notes and link fields', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  await goto(`/workouts/exercises/${bench.id}`, { waitUntil: 'hydration' })
  await expect(page.getByLabel('Notes', { exact: true })).toHaveAttribute('data-test', 'detail-notes')
  await expect(page.getByLabel('Link', { exact: true })).toHaveAttribute('data-test', 'detail-link')
})

test('a tab keeps its state across switches and history loads only when opened', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  const historyRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes(`/api/workouts/exercises/${bench.id}/history`)) historyRequests.push(request.url())
  })

  await goto(`/workouts/exercises/${bench.id}`, { waitUntil: 'hydration' })
  await page.locator('[data-test="exercise-tab-graph"]').click()
  const zero = page.getByRole('checkbox', { name: 'Start at zero' })
  await zero.click()
  await expect(zero).toBeChecked()

  await page.locator('[data-test="exercise-tab-about"]').click()
  await expect(zero).toBeHidden()
  await page.locator('[data-test="exercise-tab-graph"]').click()
  await expect(zero).toBeChecked()

  // Let every request the other tabs started settle, so a late history fetch can't slip in after the zero check.
  await page.waitForLoadState('networkidle')
  expect(historyRequests).toHaveLength(0)
  await page.locator('[data-test="exercise-tab-history"]').click()
  await expect.poll(() => historyRequests.length).toBeGreaterThan(0)
})

test('the workout settings labels bind to their inputs in the built app', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const bench = (await apiFetch<Exercise[]>(page, 'GET', '/api/workouts/exercises?q=barbell%20bench')).json[0]!
  await goto(`/workouts/exercises/${bench.id}?tab=settings`, { waitUntil: 'hydration' })
  await expect(page.getByLabel('Weight increment', { exact: true })).toHaveAttribute('data-test', 'setting-weight-increment')
  await expect(page.getByLabel('Rest (seconds)', { exact: true })).toHaveAttribute('data-test', 'setting-rest-seconds')
  await expect(page.getByRole('group', { name: 'Plates' })).toBeVisible()
})
