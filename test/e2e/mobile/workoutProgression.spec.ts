import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from '../helpers'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../../shared/types/workout'
import type { Routine } from '../../../shared/types/routine'

test.use({ viewport: { width: 390, height: 844 } })

async function logSet(page: Page, entryId: number, weight: string, reps: string) {
  const card = page.locator(`[data-test="entry-card-${entryId}"]`)
  await card.locator('[data-test="set-weight-new"]').fill(weight)
  await card.locator('[data-test="set-reps-new"]').fill(reps)
  await card.locator('[data-test="set-save-new"]').click()
}

test('phone: modal add, modal drop, no second attempt, callout carries to the next workout', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  const press = (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Progression '), categoryId: chest.id, trackingType: 'weight_reps', loadStyle: 'plain'
  })).json
  let routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('PG Phone ') })).json
  routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name: 'Day A' })).json
  const day = routine.days[0]!.id
  routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routine-days/${day}/entries`, { exerciseId: press.id })).json
  await apiFetch(page, 'PATCH', `/api/workouts/routine-entries/${routine.days[0]!.entries[0]!.id}`, { targetSets: 6, targetLow: 4, targetHigh: 6 })

  const first = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: day, performedOn: '2026-01-05' })).json
  const entryId = first.entries[0]!.id
  await goto('/workouts/log', { waitUntil: 'hydration' })
  const card = page.locator(`[data-test="entry-card-${entryId}"]`)
  const weight = card.locator('[data-test="set-weight-new"]')
  const prompt = page.locator('[data-test="progression-prompt"]')
  const callout = card.locator('[data-test="set-progression-callout"]')

  await logSet(page, entryId, '100', '6')
  await expect(prompt).toContainText('Add weight?')
  await page.locator('[data-test="progression-prompt-apply"]').click()
  await expect(prompt).toHaveCount(0)
  await expect(weight).toHaveValue('105')

  await logSet(page, entryId, '105', '3')
  await expect(prompt).toContainText('Drop back?')
  await page.locator('[data-test="progression-prompt-apply"]').click()
  await expect(weight).toHaveValue('100')

  await logSet(page, entryId, '100', '6')
  await expect(prompt).toHaveCount(0)
  await expect(callout).toHaveCount(0)
  await page.locator('[data-test="session-finish"]').click()

  const second = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { routineDayId: day, performedOn: '2026-01-07' })).json
  await goto('/workouts/log', { waitUntil: 'hydration' })
  const next = page.locator(`[data-test="entry-card-${second.entries[0]!.id}"]`)
  await expect(next.locator('[data-test="set-progression-heading"]')).toHaveText('Add weight?')
  await expect(next.locator('[data-test="set-weight-new"]')).toHaveValue('100')
  await next.locator('[data-test="set-progression-apply"]').click()
  await expect(next.locator('[data-test="set-weight-new"]')).toHaveValue('105')
  await expect(next.locator('[data-test="set-progression-callout"]')).toHaveCount(0)
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${second.id}`, { finish: true })
})
