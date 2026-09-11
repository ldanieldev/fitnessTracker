import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from '../helpers'

test('the phone sidebar reaches the diary for today', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })

  await page.getByRole('button', { name: 'Open sidebar' }).click()
  await page.getByRole('link', { name: 'Diary' }).click()

  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)
})

test('taps reach buttons at the phone viewport', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  await goto('/', { waitUntil: 'hydration' })

  expect(page.viewportSize()).toEqual({ width: 360, height: 689 })
  await page.getByRole('button', { name: 'Open sidebar' }).tap()
  await expect(page.getByRole('link', { name: 'Diary' })).toBeVisible()
})
