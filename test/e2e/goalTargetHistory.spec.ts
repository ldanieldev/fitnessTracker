import type { Page } from '@playwright/test'
import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

interface Profile {
  id: number
}

interface DayTargets {
  defaultProfileName: string | null
  targets: Array<{ key: string; amount: number }>
}

interface SummaryDay {
  date: string
  targets: Record<string, { amount: number }> | null
}

const profileBody = (name: string, energy: number, isDefault = true) => ({
  name,
  inputMode: 'grams',
  isDefault,
  targets: [{ nutrient: 'energy', amount: energy, direction: 'max' }]
})

async function logDay(page: Page, date: string) {
  const containers = await apiFetch<Array<{ id: number }>>(page, 'GET', '/api/nutrition/meal-containers')
  await apiFetch(page, 'POST', `/api/nutrition/diary/${date}/entries`, [
    {
      entryType: 'quick_add',
      containerId: containers.json[0]!.id,
      description: 'Meal',
      quantity: 1,
      unitLabel: 'serving',
      nutrients: { energy: 1800 }
    }
  ])
}

const energyOn = async (page: Page, date: string) => {
  const day = (await apiFetch<DayTargets>(page, 'GET', `/api/nutrition/diary/${date}`)).json
  return { name: day.defaultProfileName, energy: day.targets.find((t) => t.key === 'energy')?.amount ?? null }
}

test('goal history: each day keeps the default profile targets in force on its date', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const cut = (
    await apiFetch<Profile>(page, 'POST', '/api/nutrition/goal-profiles?today=2026-08-16', profileBody('Cut', 1900))
  ).json
  await apiFetch(page, 'POST', '/api/nutrition/goal-profiles?today=2026-10-11', profileBody('Break', 2300))
  await apiFetch(page, 'PUT', `/api/nutrition/goal-profiles/${cut.id}?today=2026-10-25`, profileBody('Cut', 1700))

  expect(await energyOn(page, '2026-08-15')).toEqual({ name: null, energy: null })
  expect(await energyOn(page, '2026-08-16')).toEqual({ name: 'Cut', energy: 1900 })
  expect(await energyOn(page, '2026-10-10')).toEqual({ name: 'Cut', energy: 1900 })
  expect(await energyOn(page, '2026-10-11')).toEqual({ name: 'Break', energy: 2300 })
  expect(await energyOn(page, '2026-10-24')).toEqual({ name: 'Break', energy: 2300 })
  expect(await energyOn(page, '2026-10-25')).toEqual({ name: 'Cut', energy: 1700 })

  for (const date of ['2026-10-10', '2026-10-11', '2026-10-25']) await logDay(page, date)
  const summary = await apiFetch<{ days: SummaryDay[] }>(
    page,
    'GET',
    '/api/nutrition/diary/summary?from=2026-10-10&to=2026-10-25&window=7'
  )
  const energy = (date: string) => summary.json.days.find((d) => d.date === date)!.targets!.energy!.amount
  expect([energy('2026-10-10'), energy('2026-10-11'), energy('2026-10-25')]).toEqual([1900, 2300, 1700])
})

test('goal history: same-day edits keep one entry, an edit back to the old targets drops it', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cut = (
    await apiFetch<Profile>(page, 'POST', '/api/nutrition/goal-profiles?today=2026-09-01', profileBody('Cut', 1900))
  ).json
  await apiFetch(page, 'PUT', `/api/nutrition/goal-profiles/${cut.id}?today=2026-10-01`, profileBody('Cut', 1800))
  await apiFetch(page, 'PUT', `/api/nutrition/goal-profiles/${cut.id}?today=2026-10-01`, profileBody('Cut', 1750))
  expect((await energyOn(page, '2026-10-01')).energy).toBe(1750)

  const history = async () =>
    (
      await apiFetch<{ tables: { goal_target_history: Array<{ effectiveFrom: string }> } }>(page, 'GET', '/api/export')
    ).json.tables.goal_target_history.map((h) => h.effectiveFrom)
  expect(await history()).toEqual(['2026-09-01', '2026-10-01'])

  await apiFetch(page, 'PUT', `/api/nutrition/goal-profiles/${cut.id}?today=2026-10-01`, profileBody('Cut', 1900))
  expect(await history()).toEqual(['2026-09-01'])
  expect((await energyOn(page, '2026-10-01')).energy).toBe(1900)
})

test('goal history: deleting the default ends its targets from that day, a non-default edit changes nothing', async ({
  page,
  goto
}) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())
  const cut = (
    await apiFetch<Profile>(page, 'POST', '/api/nutrition/goal-profiles?today=2026-09-01', profileBody('Cut', 1900))
  ).json
  const spare = (
    await apiFetch<Profile>(
      page,
      'POST',
      '/api/nutrition/goal-profiles?today=2026-09-02',
      profileBody('Spare', 1500, false)
    )
  ).json
  const spareEdit = profileBody('Spare', 1400, false)
  await apiFetch(page, 'PUT', `/api/nutrition/goal-profiles/${spare.id}?today=2026-09-03`, spareEdit)
  expect((await energyOn(page, '2026-09-03')).energy).toBe(1900)

  await apiFetch(page, 'DELETE', `/api/nutrition/goal-profiles/${cut.id}?today=2026-10-01`)
  expect(await energyOn(page, '2026-09-30')).toEqual({ name: 'Cut', energy: 1900 })
  expect(await energyOn(page, '2026-10-01')).toEqual({ name: null, energy: null })
  const badDate = await apiFetch(page, 'POST', '/api/nutrition/goal-profiles?today=nope', profileBody('X', 1))
  expect(badDate.status).toBe(400)
})
