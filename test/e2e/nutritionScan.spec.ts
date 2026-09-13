import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi } from './helpers'

// Distinct from the real Nutella barcode (3017624010701) already in the dev DB, so this always hits the stub route, not that local row.
const STUB_BARCODE = '4017624010700'

test('shows the viewfinder or a permission notice, and the manual path lands on the new-food page prefilled', async ({ page, goto }) => {
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

test.describe('barcode scan of a known OFF product', () => {
  test('resolves to the add page with the food checked', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const today = new Date().toISOString().slice(0, 10)
    await goto(`/diary/${today}/scan`, { waitUntil: 'hydration' })

    await page.locator('[data-test="scan-manual-input"]').fill(STUB_BARCODE)
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
    const checkedRow = page.locator('[data-test="food-hit"]').filter({ has: page.locator('input[inputmode="decimal"]') })
    await expect(checkedRow).toBeVisible()
    await expect(checkedRow).toContainText('Stub Nutella')
  })
})
