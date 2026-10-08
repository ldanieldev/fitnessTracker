import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from '../helpers'
import { todayDate } from '../../../shared/utils/nutritionSummary'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../../shared/types/workout'
import type { Routine } from '../../../shared/types/routine'

test.use({ viewport: { width: 390, height: 844 } })

async function pickMenuItem(page: Page, menu: string, item: string) {
  await page.locator(`[data-test="${menu}"]`).click()
  await page.locator(`[data-test="${item}"]`).click()
}

async function exercise(page: Page) {
  const chest = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference'))
    .json.categories.find((c) => c.key === 'chest')!
  return (await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
    name: uniquePrefix('Phone Routine '), categoryId: chest.id, trackingType: 'weight_reps', loadStyle: 'plain'
  })).json
}

async function logSet(page: Page, entryId: number, weight: string, reps: string) {
  const card = page.locator(`[data-test="entry-card-${entryId}"]`)
  await card.locator('[data-test="set-weight-new"]').fill(weight)
  await card.locator('[data-test="set-reps-new"]').fill(reps)
  await card.locator('[data-test="set-save-new"]').click()
}

test('phone: build a routine with a superset, run the due day, then an off-order day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [press, row] = [await exercise(page), await exercise(page)]
  const name = uniquePrefix('Phone R ')

  await goto('/workouts/routines', { waitUntil: 'hydration' })
  await page.locator('[data-test="routine-new"]').click()
  await page.locator('[data-test="routine-new-name"]').fill(name)
  await page.locator('[data-test="routine-new-save"]').click()
  await page.waitForURL(/\/workouts\/routines\/\d+$/)
  const routineId = Number(page.url().split('/').pop())

  await page.locator('[data-test="routine-day-add"]').click()
  await page.locator('[data-test="routine-day-name"]').fill('Day A')
  await page.locator('[data-test="routine-day-save"]').click()
  await expect.poll(async () => (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routineId}`)).json.days.length).toBe(1)
  let routine = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routineId}`)).json
  const dayA = routine.days[0]!.id
  await expect(page.locator(`[data-test="routine-day-next-${dayA}"]`)).toBeVisible()

  for (const e of [press, row]) await apiFetch(page, 'POST', `/api/workouts/routine-days/${dayA}/entries`, { exerciseId: e.id })
  await apiFetch(page, 'POST', `/api/workouts/routines/${routineId}/days`, { name: 'Pump', floating: true })
  await apiFetch(page, 'POST', `/api/workouts/routines/${routineId}/days`, { name: 'Day B' })
  await page.reload({ waitUntil: 'networkidle' })
  routine = (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routineId}`)).json
  const [ePress, eRow] = routine.days[0]!.entries as [Routine['days'][0]['entries'][0], Routine['days'][0]['entries'][0]]
  const dayB = routine.days.find((d) => d.name === 'Day B')!.id
  const rotation = async () => (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routineId}`)).json.days
    .filter((d) => !d.floating).map((d) => d.name)

  const created = uniquePrefix('Picker New ')
  await page.locator(`[data-test="routine-day-add-exercise-${dayB}"]`).click()
  await page.locator('[data-test="exercise-search"]').fill(created)
  await page.locator('[data-test="exercise-new"]').click()
  await expect(page.locator('[data-test="exercise-name"]')).toHaveValue(created)
  await page.locator('[data-test="exercise-submit"]').click()
  await expect(page.locator(`[data-test="routine-day-${dayB}"]`).getByText(created)).toBeVisible()
  await page.locator(`[data-test="routine-day-add-exercise-${dayB}"]`).click()
  await expect(page.locator('[data-test="exercise-search"]')).toHaveValue('')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-test="exercise-search"]')).toHaveCount(0)

  await pickMenuItem(page, `routine-day-menu-${dayB}`, `routine-day-up-${dayB}`)
  await expect.poll(rotation).toEqual(['Day B', 'Day A'])
  await pickMenuItem(page, `routine-day-menu-${dayB}`, `routine-day-down-${dayB}`)
  await expect.poll(rotation).toEqual(['Day A', 'Day B'])

  await page.locator(`[data-test="routine-entry-open-${ePress.id}"]`).click()
  await page.locator('[data-test="routine-entry-sets"]').fill('2')
  await page.locator('[data-test="routine-entry-low"]').fill('5')
  await page.locator('[data-test="routine-entry-high"]').fill('8')
  await page.locator('[data-test="routine-entry-rest"]').fill('120')
  await page.locator('[data-test="routine-entry-save"]').click()
  await expect(page.locator(`[data-test="routine-entry-target-${ePress.id}"]`)).toHaveText('2 × 5–8')
  await expect(page.locator(`[data-test="routine-entry-meta-${ePress.id}"]`)).toHaveText('2:00 rest')
  await apiFetch(page, 'PATCH', `/api/workouts/routine-entries/${eRow.id}`, { targetSets: 2 })

  await pickMenuItem(page, `routine-entry-menu-${ePress.id}`, `routine-entry-superset-${ePress.id}`)
  await page.locator(`[data-test="superset-option-${eRow.id}"]`).click()
  await page.locator('[data-test="superset-confirm"]').click()
  await expect(page.locator(`[data-test="routine-entry-label-${ePress.id}"]`)).toHaveText('A1')
  await expect(page.locator(`[data-test="routine-entry-label-${eRow.id}"]`)).toHaveText('A2')

  await page.locator('[data-test="routine-active"]').click()
  await expect.poll(async () => (await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routineId}`)).json.active).toBe(true)

  const messages: string[] = []
  page.on('console', (m) => messages.push(m.text()))
  await goto('/workouts/log', { waitUntil: 'hydration' })
  expect(messages.filter((m) => /hydration/i.test(m))).toEqual([])
  await expect(page.locator('[data-test="start-routine-next-name"]')).toHaveText('Day A')
  await page.locator('[data-test="start-routine-next"]').click()
  await expect.poll(async () => (await apiFetch<WorkoutSession | null>(page, 'GET', '/api/workouts/sessions/active')).json).not.toBeNull()
  const session = (await apiFetch<WorkoutSession>(page, 'GET', '/api/workouts/sessions/active')).json
  const [a1, a2] = session.entries.map((e) => e.id) as [number, number]
  await expect(page.locator(`[data-test="entry-target-${a1}"]`)).toHaveText('0 of 2 · 5–8')
  await expect(page.locator(`[data-test="entry-superset-${a2}"]`)).toHaveText('A2')

  await logSet(page, a1, '100', '8')
  await expect(page.locator('[data-test="progression-prompt"]')).toBeVisible()
  await page.locator('[data-test="progression-prompt-stay"]').click()
  await page.screenshot({ path: '.superpowers/sdd/Workout Structure Plan/screenshots/log-superset-phone.png', fullPage: true })
  await expect(page.locator(`[data-test="entry-card-${a2}"] [data-test="set-form"]`)).toBeVisible()
  await expect(page.locator(`[data-test="entry-card-${a1}"] [data-test="set-form"]`)).toBeHidden()
  await expect(page.locator('[data-test="rest-timer-pill"]')).toHaveCount(0)

  await logSet(page, a2, '80', '10')
  await expect(page.locator('[data-test="rest-timer-pill"]')).toBeVisible()
  await expect(page.locator(`[data-test="entry-card-${a1}"] [data-test="set-form"]`)).toBeVisible()
  await expect(page.locator(`[data-test="entry-target-${a1}"]`)).toHaveText('1 of 2 · 5–8')

  await logSet(page, a1, '100', '7')
  await logSet(page, a2, '80', '9')
  await expect(page.locator(`[data-test="entry-target-${a1}"]`)).toHaveText('2 of 2 · 5–8')
  await page.locator('[data-test="session-finish"]').click()
  await expect(page.locator('[data-test="start-empty"]')).toBeVisible()

  await goto(`/workouts/routines/${routineId}`, { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="routine-day-next-${dayB}"]`)).toBeVisible()

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await page.locator('[data-test="start-routine-other"]').click()
  await page.locator(`[data-test="routine-pick-${routineId}"]`).click()
  await page.locator(`[data-test="day-pick-${dayA}"]`).click()
  await expect(page.locator('[data-test="pointer-prompt-text"]')).toHaveText('You\'re starting Day A but Day B is next.')
  await page.locator('[data-test="pointer-keep"]').click()
  await expect(page.locator('[data-test="session-name"]')).toHaveValue('Day A')
  await page.locator('[data-test="session-finish"]').click()
  await expect(page.locator('[data-test="start-empty"]')).toBeVisible()

  await goto(`/workouts/routines/${routineId}`, { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="routine-day-next-${dayB}"]`)).toBeVisible()
  await page.screenshot({ path: '.superpowers/sdd/Workout Structure Plan/screenshots/routine-editor-phone.png', fullPage: true })
})

test('phone: copy a past workout with one exercise unticked shows targets', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const [one, two] = [await exercise(page), await exercise(page)]
  let source = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn: todayDate(), name: uniquePrefix('Copy Src ') })).json
  for (const e of [one, two]) {
    source = (await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${source.id}/entries`, { exerciseId: e.id })).json
  }
  for (const reps of [10, 8]) await apiFetch(page, 'POST', `/api/workouts/entries/${source.entries[0]!.id}/sets`, { weight: 60, reps })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${source.id}`, { finish: true })

  await goto('/workouts/log', { waitUntil: 'hydration' })
  await page.locator('[data-test="start-copy"]').click()
  await page.locator(`[data-test="copy-session-${source.id}"]`).click()
  await page.locator(`[data-test="copy-entry-${source.entries[1]!.id}"]`).click()
  await page.locator('[data-test="copy-start"]').click()
  await expect.poll(async () => (await apiFetch<WorkoutSession | null>(page, 'GET', '/api/workouts/sessions/active')).json).not.toBeNull()
  const copy = (await apiFetch<WorkoutSession>(page, 'GET', '/api/workouts/sessions/active')).json
  expect(copy.entries).toHaveLength(1)
  await expect(page.locator(`[data-test="entry-target-${copy.entries[0]!.id}"]`)).toHaveText('0 of 2 · 8–10')
  await page.locator('[data-test="session-finish"]').click()
  await expect(page.locator('[data-test="start-empty"]')).toBeVisible()
})

test('phone: a failed rename or notes save shows the saved text again', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const routineName = uniquePrefix('Phone Revert ')
  const routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: routineName })).json
  await goto(`/workouts/routines/${routine.id}`, { waitUntil: 'hydration' })

  await page.route(`**/api/workouts/routines/${routine.id}`, (route) =>
    route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue())
  const name = page.locator('[data-test="routine-name"]')
  const notes = page.locator('[data-test="routine-notes"]')
  await name.fill('Renamed')
  await name.blur()
  await expect(page.getByText('Couldn\'t save routine', { exact: true }).first()).toBeVisible()
  await expect(name).toHaveValue(routineName)
  await notes.fill('Draft notes')
  await notes.blur()
  await expect(notes).toHaveValue('')
})

test('phone: a second tap while a routine change is in flight is ignored', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  let routine = (await apiFetch<Routine>(page, 'POST', '/api/workouts/routines', { name: uniquePrefix('Phone Busy ') })).json
  for (const name of ['Day A', 'Day B', 'Day C']) {
    routine = (await apiFetch<Routine>(page, 'POST', `/api/workouts/routines/${routine.id}/days`, { name })).json
  }
  const [, dayB] = routine.days.map((d) => d.id)
  await goto(`/workouts/routines/${routine.id}`, { waitUntil: 'hydration' })

  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let skips = 0
  await page.route(`**/api/workouts/routines/${routine.id}/skip`, async (route) => {
    skips++
    await gate
    await route.continue()
  })
  const skip = page.locator('[data-test="routine-skip"]')
  try {
    await skip.click()
    await expect.poll(() => skips).toBe(1)
    await expect(skip).toBeDisabled()
    await skip.click({ force: true })
  } finally {
    release()
  }
  await expect(page.locator(`[data-test="routine-day-next-${dayB}"]`)).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(skips).toBe(1)
  expect((await apiFetch<Routine>(page, 'GET', `/api/workouts/routines/${routine.id}`)).json.nextDayId).toBe(dayB)
})
