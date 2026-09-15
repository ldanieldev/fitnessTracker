import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'

// Distinct from the real Nutella/Cheerios barcodes already in the dev DB, so these always hit the stub route.
const STUB_BARCODE = '4017624010700'
const STUB_BARCODE_2 = '4017624010717'

async function scanBarcode(page: import('@playwright/test').Page, today: string, code: string): Promise<string> {
  await page.locator('[data-test="scan-manual-input"]').fill(code)
  await page.locator('[data-test="scan-manual-submit"]').click()

  const addUrlPattern = new RegExp(`/diary/${today}/add\\?foodId=\\d+&containerId=\\d+$`)
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
  return new URL(page.url()).searchParams.get('foodId')!
}

test('scanning twice keeps the tray and container, and the scanned row lands in view', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/meal-containers')
  const target = containers.json[1]!

  const today = new Date().toISOString().slice(0, 10)
  await goto(`/diary/${today}/add?containerId=${target.id}`, { waitUntil: 'hydration' })
  await expect(page.locator('[data-test="add-container"]')).toContainText(target.name)

  await page.locator('[data-test="scan-button"]').click()
  await expect(page).toHaveURL(new RegExp(`/diary/${today}/scan\\?containerId=${target.id}$`))
  const firstFoodId = await scanBarcode(page, today, STUB_BARCODE)

  await expect(page.locator('[data-test="add-container"]')).toContainText(target.name)
  const checkedRows = page.locator('[data-test="food-hit"]').filter({ has: page.locator('input[inputmode="decimal"]') })
  await expect(checkedRows).toHaveCount(1)
  const firstRow = page.locator(`[data-test="food-hit"][data-food-id="${firstFoodId}"]`)
  await expect(firstRow).toContainText('Stub Nutella')
  await expect(firstRow).toBeInViewport()

  await page.locator('[data-test="scan-button"]').click()
  await expect(page).toHaveURL(new RegExp(`/diary/${today}/scan\\?containerId=${target.id}$`))
  await scanBarcode(page, today, STUB_BARCODE_2)

  await expect(page.locator('[data-test="add-container"]')).toContainText(target.name)
  await expect(checkedRows).toHaveCount(2)
  await expect(checkedRows.filter({ hasText: 'Stub Nutella' })).toHaveCount(1)
  await expect(checkedRows.filter({ hasText: 'Stub Cheerios' })).toHaveCount(1)
  await expect(page.locator('[data-test="tray-count"]')).toContainText('2 items')
})
