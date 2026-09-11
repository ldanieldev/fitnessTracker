import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from '../helpers'

interface DayJson {
  entries: Array<{ id: number, containerId: number, quantity: number, unitLabel: string, loggedAt: string, notes: string | null, nutrients: Record<string, number> }>
}

test('edits quantity, unit, meal, time, and note from the entry sheet', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = (await apiFetch<Array<{ id: number, name: string }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Sheet Bread',
    servings: [
      { kind: 'weight', label: 'g', quantity: 100, nutrients: { energy: 260 } },
      { kind: 'named', label: 'slice', quantity: 1, nutrients: { energy: 90 } }
    ]
  })
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-02/entries', [
    { entryType: 'food', containerId: containers[0]!.id, foodId: food.json.id, quantity: 100, unitLabel: 'g' }
  ])

  await goto('/diary/2026-09-02', { waitUntil: 'hydration' })
  await page.locator('[data-test="entry-row"]').click()

  await page.locator('[data-test="entry-sheet-quantity"]').fill('50')
  // Firefox doesn't focus a <button> on click, so the number field's commit-on-blur never fires without an explicit blur.
  await page.locator('[data-test="entry-sheet-quantity"]').blur()
  await expect(page.locator('[data-test="entry-sheet-preview"]')).toContainText('130')
  await page.locator('[data-test="entry-save"]').click()
  await expect.poll(async () => (await apiFetch<DayJson>(page, 'GET', '/api/nutrition/diary/2026-09-02')).json.entries[0]!.nutrients.energy).toBeCloseTo(130, 6)

  await page.locator('[data-test="entry-row"]').click()
  await page.locator('[data-test="entry-sheet-unit"]').click()
  await page.getByRole('option', { name: 'slice' }).click()
  await page.locator('[data-test="entry-sheet-quantity"]').fill('2')
  // Firefox doesn't focus a <button> on click, so the number field's commit-on-blur never fires without an explicit blur.
  await page.locator('[data-test="entry-sheet-quantity"]').blur()
  await expect(page.locator('[data-test="entry-sheet-preview"]')).toContainText('180')
  await page.locator('[data-test="entry-sheet-container"]').click()
  await page.getByRole('option', { name: containers[1]!.name }).click()
  await page.locator('[data-test="entry-sheet-time"]').fill('12:05')
  await page.locator('[data-test="entry-sheet-notes"]').fill('toasted')
  await page.locator('[data-test="entry-save"]').click()

  await expect.poll(async () => {
    const entry = (await apiFetch<DayJson>(page, 'GET', '/api/nutrition/diary/2026-09-02')).json.entries[0]!
    const at = new Date(entry.loggedAt)
    return [entry.unitLabel, entry.quantity, entry.containerId, entry.notes, at.getHours(), at.getMinutes(), Math.round(entry.nutrients.energy!)]
  }).toEqual(['slice', 2, containers[1]!.id, 'toasted', 12, 5, 180])
})

test('a quick-add entry offers no unit picker', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = (await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')).json
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-09-03/entries', [
    { entryType: 'quick_add', containerId: containers[0]!.id, description: 'Burger', quantity: 1, unitLabel: 'serving', nutrients: { energy: 700 } }
  ])
  await goto('/diary/2026-09-03', { waitUntil: 'hydration' })
  await page.locator('[data-test="entry-row"]').click()
  await expect(page.locator('[data-test="entry-sheet-quantity"]')).toBeVisible()
  await expect(page.locator('[data-test="entry-sheet-unit"]')).toHaveCount(0)
})
