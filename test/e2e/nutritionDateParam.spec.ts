import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from './helpers'

for (const path of ['2026-02-30/add', '2026-10-99/scan', 'today/foods/new', 'nope/add']) {
  test(`diary sub-page /nutrition/diary/${path} is a 404, not an API call with a bad date`, async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())
    const apiCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/nutrition/diary/')) apiCalls.push(request.url())
    })

    const response = await page.goto(new URL(`/nutrition/diary/${path}`, page.url()).toString())

    expect(response?.status()).toBe(404)
    expect(apiCalls).toEqual([])
  })
}

test('diary sub-pages still open for a real calendar date', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const response = await page.goto(new URL('/nutrition/diary/2024-02-29/add', page.url()).toString())

  expect(response?.status()).toBe(200)
  await expect(page.locator('[data-test="add-container"]')).toBeVisible()
})
