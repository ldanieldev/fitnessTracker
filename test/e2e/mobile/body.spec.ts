import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'
import type { MeasurementType } from '../../../shared/types/body'

test('the Body nav reaches the hub, a reading logs from a card, and the dashboard widget picks it up', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!

  await goto('/', { waitUntil: 'hydration' })
  await page.getByRole('button', { name: 'Open sidebar' }).tap()
  await page.getByRole('link', { name: 'Measurements' }).tap()
  await expect(page).toHaveURL(/\/body$/)

  await page.locator(`[data-test="metric-log-${weight.id}"]`).tap()
  await page.locator('input[data-test="entry-value"]').fill('197')
  await page.locator('[data-test="entry-save"]').tap()
  await expect(page.locator(`[data-test="metric-latest-${weight.id}"]`)).toHaveText('197.0')

  await page.locator(`[data-test="metric-link-${weight.id}"]`).tap()
  await expect(page).toHaveURL(new RegExp(`/body/${weight.id}$`))
  await expect(page.locator('[data-test="metric-chart"] svg')).toBeVisible()

  await goto('/', { waitUntil: 'hydration' })
  await expect(page.locator(`[data-test="dashboard-body"] [data-test="metric-latest-${weight.id}"]`)).toHaveText('197.0')
  await page.locator(`[data-test="dashboard-body"] [data-test="metric-link-${weight.id}"]`).tap()
  await expect(page).toHaveURL(new RegExp(`/body/${weight.id}$`))
})

test('no body screen scrolls sideways at the phone width, and they render on the Graphite background', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const weight = (await apiFetch<MeasurementType[]>(page, 'GET', '/api/body/types')).json.find((t) => t.key === 'bodyweight')!
  await apiFetch(page, 'POST', '/api/body/entries', { typeId: weight.id, value: 200 })
  await apiFetch(page, 'PUT', `/api/body/types/${weight.id}/goal`, { targetValue: 185 })

  for (const route of ['/body', `/body/${weight.id}`, '/body/goals', '/body/progress', '/']) {
    await goto(route, { waitUntil: 'hydration' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, route).toBeLessThanOrEqual(0)
  }
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(14, 16, 21)')
})
