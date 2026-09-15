import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from '../helpers'
import { todayDate } from '../../../shared/utils/nutritionSummary'

test('taps reach buttons at the phone viewport', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })

  expect(page.viewportSize()).toEqual({ width: 360, height: 689 })
  await page.getByRole('button', { name: 'Open sidebar' }).tap()
  await expect(page.getByRole('link', { name: 'Diary' })).toBeVisible()
})

test('the dashboard Today card reaches the diary for today', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })

  const card = page.locator('[data-test="dashboard-today"]')
  await expect(card).toBeVisible()
  await card.click()

  await expect(page).toHaveURL(new RegExp(`/diary/${todayDate()}$`))
})
