import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, rebuildSearchIndex, registerViaApi, uniquePrefix } from './helpers'

test('logs, views, toggles and deletes a diary entry', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles?today=2026-07-01', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1900, direction: 'max' }]
  })

  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Chicken Breast',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })
  const foodId = food.json.id

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-01/entries', [
    { entryType: 'food', containerId, foodId, quantity: 150, unitLabel: 'g' }
  ])

  await goto('/nutrition/diary/2026-07-01', { waitUntil: 'hydration' })

  const entryRow = page.locator('[data-test="entry-row"]')
  await expect(entryRow).toContainText('Chicken Breast')
  await expect(entryRow).toContainText('15')

  const container = page.locator(`[data-test="container-${containerId}"]`)
  await expect(container.locator('[data-test="subtotal-protein"]')).toContainText('15')
  await expect(page.locator('[data-test="total-protein"]')).toContainText('15')

  const energyValue = page.locator('[data-test="energy-value"]')
  const before = await energyValue.textContent()
  await page.locator('[data-test="summary-goal-menu"]').click()
  await page.getByRole('menuitemcheckbox', { name: 'Consumed' }).click()
  await expect(energyValue).not.toHaveText(before ?? '')

  const heading = page.locator('[data-test="diary-date"]')
  await page.locator('[data-test="week-day-2026-06-30"]').click()
  await expect(heading).toHaveAttribute('data-date', '2026-06-30')
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-06-30$/)

  await page.locator('[data-test="week-day-2026-07-02"]').click()
  await expect(heading).toHaveAttribute('data-date', '2026-07-02')
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-07-02$/)

  await goto('/nutrition/diary/2026-07-01', { waitUntil: 'hydration' })
  await entryRow.click()
  await page.locator('[data-test="entry-delete"]').click()
  await page.locator('[data-test="entry-delete-confirm"]').click()
  await expect(entryRow).toHaveCount(0)
})

test('creates a slice-only food through the form and logs it', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const p = uniquePrefix()

  await goto('/nutrition/diary/2026-07-03/foods/new', { waitUntil: 'hydration' })

  await page.locator('[data-test="food-name"]').fill(`${p} Pizza`)
  await page.locator('[data-test="serving-label"]').fill('slice')
  await page.locator('[data-test="serving-protein"]').fill('3')
  await page.locator('[data-test="serving-carbohydrate"]').fill('2')
  await page.locator('[data-test="serving-fat"]').fill('5')

  await page.locator('[data-test="food-submit"]').click()
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-07-03\/add$/)

  // A long result list previously pushed the desktop add-tray below the fold; pad the list to guard the sticky fix.
  for (let i = 0; i < 30; i++) {
    await apiFetch(page, 'POST', '/api/nutrition/foods', {
      name: `${p} Filler ${i}`,
      servings: [{ kind: 'named', label: 'each', quantity: 1, nutrients: { energy: 50 } }]
    })
  }
  await rebuildSearchIndex(page)

  // The bare prefix ties all 31 foods (tie order = index insertion order); the full name ranks Pizza first.
  await page.locator('[data-test="food-search-input"]').fill(`${p} Pizza`)
  const hitRow = page.locator('[data-test="food-hit"]', { hasText: `${p} Pizza` })
  await expect(hitRow).toBeVisible()

  await hitRow.locator('[data-test="food-hit-checkbox"]').click()
  await hitRow.locator('input[inputmode="decimal"]').fill('2')

  const addSelected = page.locator('[data-test="add-selected"]')
  await expect(addSelected).toBeInViewport()

  await addSelected.click()
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-07-03$/)

  const entryRow2 = page.locator('[data-test="entry-row"]')
  await expect(entryRow2).toContainText(`${p} Pizza`)
  await expect(entryRow2.locator('[data-test="entry-protein"]')).toContainText('6')
})

test('selection mode resets when navigating to another day', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const containerId = containers.json[0]!.id

  const food = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/foods', {
    name: 'Selection Reset Food',
    servings: [{ kind: 'weight', label: 'g', quantity: 100, nutrients: { protein: 10 } }]
  })

  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-01/entries', [
    { entryType: 'food', foodId: food.json.id, containerId, quantity: 100, unitLabel: 'g' }
  ])

  await goto('/nutrition/diary/2026-07-01', { waitUntil: 'hydration' })

  const toggle = page.locator('[data-test="toggle-select-mode"]')
  const copySelected = page.locator('[data-test="copy-selected"]')

  await page.locator('[data-test="day-menu"]').click()
  await page.getByRole('menuitem', { name: 'Edit multiple' }).click()
  await expect(toggle).toHaveText('Cancel')

  await page.locator('[data-test="entry-select"]').click()
  await expect(copySelected).toBeVisible()
  await expect(copySelected).toBeEnabled()

  await page.locator('[data-test="week-day-2026-07-02"]').click()
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-07-02$/)

  await expect(toggle).toHaveCount(0)
  await expect(page.locator('[data-test="entry-select"]')).toHaveCount(0)
  await expect(copySelected).toHaveCount(0)

  await page.locator('[data-test="week-day-2026-07-01"]').click()
  await expect(page).toHaveURL(/\/nutrition\/diary\/2026-07-01$/)

  await expect(page.locator('[data-test="entry-row"]')).toHaveCount(1)
  await expect(page.locator('[data-test="entry-select"]')).toHaveCount(0)
  await expect(toggle).toHaveCount(0)
})

const quickAdd = (containerId: number, description: string) => ({
  entryType: 'quick_add',
  containerId,
  description,
  quantity: 1,
  unitLabel: 'serving',
  nutrients: { protein: 5 }
})

test('deletes the selected entries after a confirm', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const [first, second] = containers.json.map((c) => c.id)
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-03/entries', [
    quickAdd(first!, 'Keep me'),
    quickAdd(first!, 'Drop one'),
    quickAdd(second!, 'Drop two')
  ])

  await goto('/nutrition/diary/2026-07-03', { waitUntil: 'hydration' })
  await page.locator('[data-test="day-menu"]').click()
  await page.getByRole('menuitem', { name: 'Edit multiple' }).click()

  const deleteSelected = page.locator('[data-test="delete-selected"]')
  await expect(deleteSelected).toBeDisabled()
  const rows = page.locator('[data-test="entry-row"]')
  await rows.filter({ hasText: 'Drop one' }).locator('[data-test="entry-select"]').click()
  await rows.filter({ hasText: 'Drop two' }).locator('[data-test="entry-select"]').click()
  await expect(deleteSelected).toHaveText('Delete (2)')

  await deleteSelected.click()
  await expect(page.getByText('Delete 2 entries?')).toBeVisible()
  await page.locator('[data-test="delete-selected-confirm"]').click()

  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('Keep me')
  await expect(deleteSelected).toHaveCount(0)
  const day = await apiFetch<{ entries: { description: string }[] }>(page, 'GET', '/api/nutrition/diary/2026-07-03')
  expect(day.json.entries.map((e) => e.description)).toEqual(['Keep me'])
})

test('holding an entry starts multi-edit with that entry selected', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-06/entries', [
    quickAdd(containers.json[0]!.id, 'Held'),
    quickAdd(containers.json[0]!.id, 'Other')
  ])

  await goto('/nutrition/diary/2026-07-06', { waitUntil: 'hydration' })
  const rows = page.locator('[data-test="entry-row"]')
  await rows.filter({ hasText: 'Held' }).locator('[data-test="entry-row-title"]').hover()
  await page.mouse.down()
  await page.waitForTimeout(700)
  await page.mouse.up()

  await expect(page.locator('[data-test="delete-selected"]')).toHaveText('Delete (1)')
  await expect(rows.filter({ hasText: 'Held' }).getByRole('checkbox')).toBeChecked()
  await expect(rows.filter({ hasText: 'Other' }).getByRole('checkbox')).not.toBeChecked()
  await expect(page.locator('[data-test="entry-sheet-quantity"]')).toHaveCount(0)

  await rows.filter({ hasText: 'Other' }).locator('[data-test="entry-row-title"]').click()
  await expect(page.locator('[data-test="delete-selected"]')).toHaveText('Delete (2)')
})

test('a meal\'s Edit multiple selects only that meal\'s entries', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const [first, second] = containers.json.map((c) => c.id)
  await apiFetch(page, 'POST', '/api/nutrition/diary/2026-07-07/entries', [
    quickAdd(first!, 'Meal one A'),
    quickAdd(first!, 'Meal one B'),
    quickAdd(second!, 'Meal two A')
  ])

  await goto('/nutrition/diary/2026-07-07', { waitUntil: 'hydration' })
  await page.locator('[data-test="container-menu"]').first().click()
  await page.getByRole('menuitem', { name: 'Edit multiple' }).click()

  await expect(page.locator('[data-test="delete-selected"]')).toHaveText('Delete (2)')
  const rows = page.locator('[data-test="entry-row"]')
  await expect(rows.filter({ hasText: 'Meal two A' }).getByRole('checkbox')).not.toBeChecked()
})

test('bulk delete removes nothing when any id is not the user\'s', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const containers = await apiFetch<{ id: number }[]>(page, 'GET', '/api/nutrition/meal-containers')
  const created = await apiFetch<{ ids: number[] }>(page, 'POST', '/api/nutrition/diary/2026-07-04/entries', [
    quickAdd(containers.json[0]!.id, 'Survivor')
  ])

  const res = await apiFetch(page, 'POST', '/api/nutrition/diary/entries/delete', {
    ids: [...created.json.ids, 2147483647]
  })
  expect(res.status).toBe(404)
  const day = await apiFetch<{ entries: unknown[] }>(page, 'GET', '/api/nutrition/diary/2026-07-04')
  expect(day.json.entries).toHaveLength(1)
})
