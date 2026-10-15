import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { apiFetch, makeUser, registerViaApi, uniquePrefix } from './helpers'
import type { ExerciseDetail } from '../../shared/types/workout'

async function formPages(page: Page) {
  await registerViaApi(page, makeUser())
  const reference = (await apiFetch<{ categories: { id: number }[] }>(page, 'GET', '/api/workouts/reference')).json
  const exercise = (
    await apiFetch<ExerciseDetail>(page, 'POST', '/api/workouts/exercises', {
      name: uniquePrefix('Labels '),
      categoryId: reference.categories[0]!.id,
      trackingType: 'reps'
    })
  ).json
  return [
    '/settings/profile',
    '/settings/workout',
    '/settings/nutrition',
    '/settings/data',
    '/settings/security',
    '/workouts/progress',
    `/workouts/exercises/${exercise.id}`
  ]
}

test('server-rendered form labels point at their controls after hydration', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  const pages = await formPages(page)
  const unbound: string[] = []
  for (const path of pages) {
    await goto(path, { waitUntil: 'hydration' })
    const missing = await page
      .locator('label[for]')
      .evaluateAll((els) =>
        els.filter((el) => !document.getElementById(el.getAttribute('for')!)).map((el) => el.textContent!.trim())
      )
    unbound.push(...missing.map((label) => `${path} → ${label}`))
    if (await page.locator('form[name="undefined"]').count()) unbound.push(`${path} → form name="undefined"`)
  }
  expect(unbound).toEqual([])
})

// Reka UI fills these in only after mount, so a server render without them changes the HTML on hydration.
test('server-rendered checkboxes and switches carry their aria-label', async ({ page, goto, browser }) => {
  await goto('/', { waitUntil: 'hydration' })
  const pages = await formPages(page)
  const origin = new URL(page.url()).origin
  const noJs = await browser.newContext({ javaScriptEnabled: false, storageState: await page.context().storageState() })
  const ssr = await noJs.newPage()
  const unnamed: string[] = []
  for (const path of pages) {
    await ssr.goto(`${origin}${path}`)
    const missing = await ssr
      .locator('[role="checkbox"]:not([aria-label]), [role="switch"]:not([aria-label])')
      .evaluateAll((els) => els.map((el) => el.closest('[data-slot="root"]')?.textContent?.trim() ?? el.outerHTML))
    unnamed.push(...missing.map((control) => `${path} → ${control}`))
  }
  await noJs.close()
  expect(unnamed).toEqual([])
})
