import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

const NUTELLA_BARCODE = '4017624010700'
const BISCOFF_BARCODE = '4017624010724'

test.describe('barcode fill: source kcal warning and name hint', () => {
  test.skip(!process.env.NUXT_OFF_USER_AGENT, 'OFF not configured')

  test('warns about the kcal mismatch and offers the barcode name on a new food', async ({ page, goto }) => {
    // Headless browsers have no camera, so a fake stream and BarcodeDetector stand in for a scan of the stub barcode.
    await page.addInitScript((code) => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const canvas = document.createElement('canvas')
            canvas.width = 64
            canvas.height = 48
            canvas.getContext('2d')!.fillRect(0, 0, 64, 48)
            return canvas.captureStream()
          }
        }
      })
      Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => 64 })
      Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => 48 })
      HTMLMediaElement.prototype.play = async () => {}
      Object.defineProperty(window, 'BarcodeDetector', {
        configurable: true,
        value: class {
          static async getSupportedFormats() {
            return ['ean_13']
          }

          async detect() {
            return [{ format: 'ean_13', rawValue: code }]
          }
        }
      })
    }, BISCOFF_BARCODE)

    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())
    await goto('/nutrition/foods/new', { waitUntil: 'hydration' })

    await page.locator('[data-test="food-name"]').fill('Cookie butter')
    await page.locator('[data-test="food-barcode-scan"]').click()

    await expect(page.locator('[data-test="energy-mismatch"]')).toContainText(
      'Open Food Facts says 567 kcal per 100 g, the macros give 171. Check the macros against the label.'
    )
    const hint = page.locator('[data-test="barcode-suggestion-name"]')
    await expect(hint).toContainText('Barcode says: Stub Biscoff Spread')
    await expect(page.locator('[data-test="food-name"]')).toHaveValue('Cookie butter')

    await hint.getByRole('button', { name: 'Use this name' }).click()
    await expect(page.locator('[data-test="food-name"]')).toHaveValue('Stub Biscoff Spread')
    await expect(hint).toHaveCount(0)
  })

  test('the import route reports the source kcal mismatch', async ({ page, goto }) => {
    await goto('/', { waitUntil: 'hydration' })
    await registerViaApi(page, makeUser())

    const biscoff = await apiFetch<{ energyMismatch: unknown }>(page, 'POST', '/api/nutrition/foods/import', {
      source: 'off',
      externalId: BISCOFF_BARCODE
    })
    expect(biscoff.status).toBe(200)
    expect(biscoff.json.energyMismatch).toEqual({ sourceKcal: 566.7, macroKcal: 171 })

    const nutella = await apiFetch<{ energyMismatch: unknown }>(page, 'POST', '/api/nutrition/foods/import', {
      source: 'off',
      externalId: NUTELLA_BARCODE
    })
    expect(nutella.status).toBe(200)
    expect(nutella.json.energyMismatch).toBeNull()
  })
})
