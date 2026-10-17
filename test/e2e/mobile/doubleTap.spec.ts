import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, rebuildSearchIndex, registerViaApi, uniquePrefix } from '../helpers'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../../shared/types/workout'

test.use({ viewport: { width: 360, height: 800 } })

test('phone: a double tap on Log Set logs one set', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const category = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json
    .categories[0]!
  const lift = (
    await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
      name: uniquePrefix('Press '),
      categoryId: category.id,
      trackingType: 'weight_reps'
    })
  ).json
  const session = (
    await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: '2026-02-03' })
  ).json
  const entryId = (
    await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, {
      exerciseId: lift.id
    })
  ).json.entries[0]!.id

  await goto('/workouts/log', { waitUntil: 'hydration' })
  const card = page.locator(`[data-test="entry-card-${entryId}"]`)
  await card.locator('[data-test="set-weight-new"]').fill('100')
  await card.locator('[data-test="set-reps-new"]').fill('8')
  await card.locator('[data-test="set-save-new"]').evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })

  await expect(card.locator('[data-test="set-row"]')).toHaveCount(1)
  await expect(card.locator('[data-test="set-save-new"]')).toBeEnabled()
  const saved = (await apiFetch<WorkoutSession>(page, 'GET', `/api/workouts/sessions/${session.id}`)).json
  expect(saved.entries[0]!.sets).toHaveLength(1)
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
})

test('phone: a double tap on Add to <meal> logs the tray once', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const p = uniquePrefix()
  await apiFetch(page, 'POST', '/api/nutrition/foods', {
    name: `${p} Rice`,
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 130 } }]
  })
  await rebuildSearchIndex(page)

  await goto('/nutrition/diary/2026-09-02/add', { waitUntil: 'hydration' })
  await page.locator('[data-test="food-search-input"]').fill(`${p} Rice`)
  await page
    .locator('[data-test="food-hit"]', { hasText: `${p} Rice` })
    .locator('[data-test="food-hit-checkbox"]')
    .click()
  await expect(page.locator('[data-test="tray-count"]')).toContainText('1 item')
  await page.locator('[data-test="add-selected"]').evaluate((button: HTMLButtonElement) => {
    button.click()
    button.click()
  })

  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-09-02$/)
  const day = await apiFetch<{ entries: unknown[] }>(page, 'GET', '/api/nutrition/diary/2026-09-02')
  expect(day.json.entries).toHaveLength(1)
})
