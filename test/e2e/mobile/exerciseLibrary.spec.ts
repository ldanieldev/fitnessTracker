import { expect, test } from '@nuxt/test-utils/playwright'
import { makeUser, registerViaApi, uniquePrefix } from '../helpers'

test.use({ viewport: { width: 390, height: 844 } })

test('phone: paging, search, filter, settings, photos, custom exercise, variation, hide', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const name = uniquePrefix('Board Press ')

  await goto('/workouts/exercises', { waitUntil: 'hydration' })
  const rows = page.locator('[data-test="exercise-list"] [data-test="exercise-row"]')
  await expect(rows).toHaveCount(20)
  // The colour classes live in shared/, which Tailwind only scans because main.css names it as a source.
  const dotColour = await page.locator('[data-test^="exercise-category-"]').first()
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(dotColour).not.toBe('rgba(0, 0, 0, 0)')

  const firstRow = rows.first()
  const rowBox = (await firstRow.boundingBox())!
  await firstRow.click({ position: { x: 24, y: rowBox.height - 10 } })
  await expect(page).toHaveURL(/\/workouts\/exercises\/\d+$/)
  await page.goBack()
  await expect(rows.first()).toBeVisible()

  await page.locator('[data-test="exercise-list-end"]').scrollIntoViewIfNeeded()
  // Reaching the end may pull more than one page when the sentinel stays in view, so assert growth, not an exact count.
  await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(40)

  await page.locator('[data-test="exercise-search"]').fill('dum press')
  await expect(page.locator('[data-test="exercise-list"]').getByRole('link')).not.toHaveCount(0)

  await page.locator('[data-test="filter-open"]').click()
  await page.locator('[data-test="muscle-lats"]').click()
  await page.locator('[data-test="filter-apply"]').click()
  await expect(page.locator('[data-test="filter-badge"]')).toHaveText('1')

  await page.locator('[data-test="exercise-search"]').fill('barbell bench press')
  await page.locator('[data-test="filter-open"]').click()
  await page.locator('[data-test="filter-clear"]').click()
  await page.locator('[data-test="filter-apply"]').click()
  await page.locator('[data-test="exercise-list"]').getByRole('link').first().click()

  await page.getByRole('tab', { name: 'Settings' }).click()
  await page.locator('[data-test="setting-rest-seconds"]').fill('180')
  // Save is a fire-and-forget PUT with no success toast; reloading before it lands races the write on Firefox.
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/prefs') && res.request().method() === 'PUT'),
    page.locator('[data-test="settings-save"]').click()
  ])
  await page.reload()
  await page.getByRole('tab', { name: 'Settings' }).click()
  await expect(page.locator('[data-test="setting-rest-seconds"]')).toHaveValue('180')

  await page.locator('[data-test="setting-bar-weight"]').fill('35')
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/prefs') && res.request().method() === 'PUT'),
    page.locator('[data-test="settings-save"]').click()
  ])
  await page.reload()
  await page.getByRole('tab', { name: 'Settings' }).click()
  await expect(page.locator('[data-test="setting-bar-weight"]')).toHaveValue('35')

  await page.getByRole('tab', { name: 'About' }).click()
  await page.locator('[data-test="detail-image-0"]').click()
  await expect(page.locator('[data-test="image-viewer"]')).toBeVisible()
  await expect(page.locator('[data-test="image-viewer-count"]')).toHaveText('1 / 2')
  await page.locator('[data-test="image-viewer-next"]').click()
  await expect(page.locator('[data-test="image-viewer-count"]')).toHaveText('2 / 2')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-test="image-viewer"]')).toHaveCount(0)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.locator('[data-test="detail-image-0"]').click()
  const photo = page.locator('[data-test="image-viewer"] img')
  await expect(photo).toBeVisible()
  const box = (await photo.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(390)
  expect(box.height).toBeGreaterThan(300)
  await page.locator('[data-test="image-viewer-close"]').click()
  await expect(page.locator('[data-test="image-viewer"]')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })

  await goto('/workouts/exercises', { waitUntil: 'hydration' })
  await page.locator('[data-test="exercise-create"]').click()
  await page.locator('[data-test="exercise-name"]').fill(name)
  await page.locator('[data-test="exercise-muscle-chest"]').click()
  await page.locator('[data-test="exercise-submit"]').click()
  // The page behind a closing sheet ignores input, so a search typed before it detaches is silently dropped.
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.locator('[data-test="exercise-search"]').fill(name)
  await expect(page.locator('[data-test="exercise-list"]')).toContainText(name)

  await page.locator('[data-test="exercise-list"]').getByRole('link').first().click()
  await page.getByRole('tab', { name: 'Variations' }).click()
  await page.locator('[data-test="variation-link"]').click()
  await page.locator('[data-test="variation-new"]').click()
  await page.locator('[data-test="variation-name"]').fill(`${name}Group`)
  await page.locator('[data-test="variation-save"]').click()
  await expect(page.locator('[data-test="variation-list"]')).toContainText(`${name}Group`)

  await goto('/workouts/exercises', { waitUntil: 'hydration' })
  await page.locator('[data-test="exercise-search"]').fill(name)
  const list = page.locator('[data-test="exercise-list"]')
  // The search debounce means the unfiltered list is on screen first, so count the row rather than the text.
  await expect(list.locator('[data-test="exercise-row"]')).toHaveCount(1)
  const row = list.locator('[data-test="exercise-row"]').filter({ hasText: name })
  await expect(row.locator('[data-test^="exercise-hide-"]')).toHaveAttribute('aria-label', 'Hide')
  await row.locator('[data-test^="exercise-hide-"]').click()
  await expect(row).toHaveCount(0)

  await page.locator('[data-test="chip-hidden"]').click()
  await expect(row).toHaveCount(1)
  await expect(row.locator('[data-test^="exercise-hide-"]')).toHaveAttribute('aria-label', 'Unhide')
  await row.locator('[data-test^="exercise-hide-"]').click()
  await expect(row.locator('[data-test^="exercise-hide-"]')).toHaveAttribute('aria-label', 'Hide')
})
