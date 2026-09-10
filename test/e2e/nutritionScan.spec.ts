import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from './helpers'

const NUTELLA_BARCODE = '3017624010701'

test('shows the viewfinder or a permission notice, and the manual path lands on the new-food page prefilled', async ({ page, goto }) => {
  test.skip(!process.env.NUXT_OFF_USER_AGENT, 'OFF not configured')

  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const today = new Date().toISOString().slice(0, 10)
  await goto(`/diary/${today}/scan`, { waitUntil: 'hydration' })

  const video = page.locator('[data-test="scan-video"]')
  const permissionNotice = page.locator('[data-test="scan-permission-notice"]')
  await expect(video.or(permissionNotice)).toBeVisible()

  await page.locator('[data-test="scan-manual-input"]').fill('0000000000000')
  await page.locator('[data-test="scan-manual-submit"]').click()

  await expect(page).toHaveURL(new RegExp(`/diary/${today}/foods/new\\?barcode=0000000000000$`))
  await expect(page.locator('[data-test="food-barcode"]')).toHaveValue('0000000000000')
})

// Nutella was already imported into the dev DB by earlier runs, so the lookup may return `local` immediately; both paths are accepted.
test.describe('barcode scan of a known OFF product', () => {
  test.skip(!process.env.NUXT_OFF_USER_AGENT, 'OFF not configured')

  test('resolves to the add page with the food checked', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const today = new Date().toISOString().slice(0, 10)
    await goto(`/diary/${today}/scan`, { waitUntil: 'hydration' })

    await page.locator('[data-test="scan-manual-input"]').fill(NUTELLA_BARCODE)
    await page.locator('[data-test="scan-manual-submit"]').click()

    const addUrlPattern = new RegExp(`/diary/${today}/add\\?foodId=\\d+$`)
    const externalCard = page.locator('[data-test="scan-external-card"]')

    await Promise.race([
      page.waitForURL(addUrlPattern).catch(() => {}),
      externalCard.waitFor({ state: 'visible' }).catch(() => {})
    ])

    if (await externalCard.isVisible()) {
      await page.locator('[data-test="scan-import"]').click()
      await page.waitForURL(addUrlPattern)
    }

    await expect(page).toHaveURL(addUrlPattern)
    // The dev DB accumulates catalogue foods across runs, so the checked row isn't necessarily first — find it by its amount input.
    const checkedRow = page.locator('[data-test="food-hit"]').filter({ has: page.locator('input[role="spinbutton"]') })
    await expect(checkedRow).toBeVisible()
  })
})
