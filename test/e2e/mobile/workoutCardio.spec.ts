import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from '../helpers'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../../shared/types/workout'

test.use({ viewport: { width: 360, height: 800 } })

test('phone: log a run in miles and m:ss, edit it, and store metres and seconds', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cardio = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'cardio')!
  const run = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Run '), categoryId: cardio.id, trackingType: 'distance_time'
  })).json
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-02-02' })).json
  const entryId = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
    exerciseId: run.id
  })).json.entries[0]!.id

  await goto('/workouts/log', { waitUntil: 'hydration' })
  const card = page.locator(`[data-test="entry-card-${entryId}"]`)
  const distance = card.locator('[data-test="set-distance-new"]')
  const duration = card.locator('[data-test="set-duration-new"]')

  await distance.fill('26.22')
  await duration.fill('10530')
  await duration.blur()
  await expect(duration).toHaveValue('1:05:30')
  expect(await distance.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await duration.evaluate((el: HTMLInputElement) => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await distance.fill('3.1')
  await duration.fill('2530')
  await card.locator('[data-test="set-save-new"]').click()
  await expect(card.locator('[data-test="set-row"]')).toHaveCount(1)
  const setId = (await card.locator('[data-test^="set-line-"]').getAttribute('data-test'))!.replace('set-line-', '')
  await expect(card.locator(`[data-test="set-measure-${setId}-distance"]`)).toHaveText('3.1 mi')
  await expect(card.locator(`[data-test="set-measure-${setId}-duration"]`)).toHaveText('25:30')
  await expect(distance).toHaveValue('3.1')
  await expect(duration).toHaveValue('25:30')

  await card.locator(`[data-test="set-menu-${setId}"]`).click()
  await page.locator(`[data-test="set-edit-${setId}"]`).click()
  await card.locator(`[data-test="set-duration-${setId}"]`).fill('24:59')
  await card.locator(`[data-test="set-save-${setId}"]`).click()
  await expect(card.locator(`[data-test="set-measure-${setId}-duration"]`)).toHaveText('24:59')

  const saved = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${session.id}`)).json
  expect(saved.entries[0]!.sets[0]).toMatchObject({ distanceMeters: 4988.97, durationSeconds: 1499 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
})
