import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from '../helpers'
import type { Exercise, ExerciseCategory, WorkoutSession } from '../../../shared/types/workout'

test.use({ viewport: { width: 360, height: 689 } })

async function logWorkout(page: Page, performedOn: string, name: string, exerciseId: number) {
  const session = (await apiFetch<WorkoutSession>(page, 'POST', '/api/workouts/sessions', { performedOn })).json
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { name })
  const entry = (
    await apiFetch<WorkoutSession>(page, 'POST', `/api/workouts/sessions/${session.id}/entries`, { exerciseId })
  ).json.entries[0]!
  await apiFetch(page, 'POST', `/api/workouts/entries/${entry.id}/sets`, { weight: 100, reps: 5 })
  await apiFetch(page, 'PATCH', `/api/workouts/sessions/${session.id}`, { finish: true })
  return session.id
}

test('phone: month dots, tap a day, list view, filter by category and clear it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cats = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json
    .categories
  const chest = cats.find((c) => c.key === 'chest')!
  const back = cats.find((c) => c.key === 'back')!
  const make = async (categoryId: number) =>
    (
      await apiFetch<Exercise>(page, 'POST', '/api/workouts/exercises', {
        name: uniquePrefix('PhoneCal '),
        categoryId,
        trackingType: 'weight_reps',
        loadStyle: 'plain'
      })
    ).json
  const [press, row] = [await make(chest.id), await make(back.id)]
  const pushName = uniquePrefix('Push ')
  const pullName = uniquePrefix('Pull ')
  await logWorkout(page, '2026-03-01', pushName, press.id)
  await logWorkout(page, '2026-03-12', pullName, row.id)
  const aprilName = uniquePrefix('April ')
  await logWorkout(page, '2026-04-01', aprilName, press.id)

  await goto('/workouts/sessions?month=2026-03', { waitUntil: 'hydration' })
  const first = page.locator('[data-test="calendar-day-2026-03-01"]')
  await expect(first.locator('[data-test="calendar-dot"]')).toHaveCount(1)
  await expect(page.locator('[data-test="calendar-day-2026-03-12"] [data-test="calendar-dot"]')).toHaveCount(1)

  await page.locator('[data-test="calendar-day-2026-04-01"]').click()
  await expect.poll(() => page.url()).toContain('month=2026-04')
  expect(page.url()).toContain('day=2026-04-01')
  await expect(page.locator('[data-test="history-day-rows"]')).toContainText(aprilName)
  await goto('/workouts/sessions?month=2026-03', { waitUntil: 'hydration' })
  const sessionRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/workouts/sessions?')) sessionRequests.push(request.url())
  })

  await first.click()
  await expect(page.locator('[data-test="history-day-rows"]')).toContainText(pushName)
  await page.locator('[data-test="calendar-day-2026-03-02"]').click()
  await expect(page.locator('[data-test="history-day-empty"]')).toBeVisible()
  expect(sessionRequests).toEqual([])

  await page.locator('[data-test="history-filter-open"]').click()
  await page.locator(`[data-test="filter-category-${back.id}"]`).click()
  await page.locator('[data-test="filter-apply"]').click()
  await expect(page.locator('[data-test="history-filter-chip"]')).toBeVisible()
  await expect(page.locator('[data-test="history-filter-count"]')).toHaveText('1')
  await expect(first.locator('[data-test="calendar-dot"]')).toHaveCount(0)
  await expect(page.locator('[data-test="calendar-day-2026-03-12"] [data-test="calendar-dot"]')).toHaveCount(1)
  expect(page.url()).toContain(`cat=${back.id}`)
  await expect.poll(() => sessionRequests.length).toBeGreaterThan(0)
  expect(sessionRequests, 'month view').toEqual(sessionRequests.filter((url) => url.includes('from=')))
  sessionRequests.length = 0

  await page.locator('[data-test="history-view-list"]').click()
  await expect(page.locator('[data-test="session-row"]')).toHaveCount(1)
  expect(sessionRequests).toHaveLength(1)
  expect(sessionRequests[0]).toContain('limit=20')
  expect(sessionRequests[0]).not.toContain('from=')
  await expect(page.locator('[data-test="session-list"]')).toContainText(pullName)

  await page.locator('[data-test="history-filter-chip-clear"]').click()
  await expect(page.locator('[data-test="history-filter-chip"]')).toHaveCount(0)
  await expect(page.locator('[data-test="session-list"]')).toContainText(pushName)
  expect(sessionRequests.some((url) => url.includes('from='))).toBe(false)

  await page.reload()
  await expect(page.locator('[data-test="session-list"]')).toBeVisible()
  expect(page.url()).toContain('view=list')
})

test('phone: the empty-day message waits for the month to load', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  try {
    await goto('/workouts/sessions?view=list&month=2026-03&day=2026-03-02', { waitUntil: 'hydration' })
    const held = page.waitForRequest(
      (request) => request.url().includes('/api/workouts/sessions?') && request.url().includes('from=')
    )
    await page.route(
      (url) => url.pathname === '/api/workouts/sessions' && url.searchParams.has('from'),
      async (route) => {
        await gate
        await route.continue()
      }
    )
    await page.locator('[data-test="history-view-month"]').click()
    await held
    await expect(page.locator('[data-test="calendar-day-2026-03-02"]')).toBeVisible()
    await expect(page.locator('[data-test="history-day-empty"]')).toHaveCount(0)
  } finally {
    release()
  }
  await expect(page.locator('[data-test="history-day-empty"]')).toBeVisible()
})

test('phone: export the filtered history as CSV', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cats = (await apiFetch<{ categories: ExerciseCategory[] }>(page, 'GET', '/api/workouts/reference')).json
    .categories
  const back = cats.find((c) => c.key === 'back')!
  await goto('/workouts/sessions?month=2026-03', { waitUntil: 'hydration' })

  await page.locator('[data-test="history-filter-open"]').click()
  await page.locator(`[data-test="filter-category-${back.id}"]`).click()
  await page.locator('[data-test="filter-apply"]').click()
  await expect(page.locator('[data-test="history-filter-chip"]')).toBeVisible()

  await page.locator('[data-test="history-menu"]').click()
  await page.locator('[data-test="history-export-open"]').click()
  await expect(page.locator('[data-test="export-sheet"]')).toBeVisible()

  const responsePromise = page.waitForResponse((response) => response.url().includes('/api/workouts/sessions/export'))
  const downloadPromise = page.waitForEvent('download')
  await page.locator('[data-test="export-download"]').click()
  const response = await responsePromise
  await downloadPromise
  expect(new URL(response.url()).searchParams.get('categories')).toBe(String(back.id))
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('text/csv')
})
