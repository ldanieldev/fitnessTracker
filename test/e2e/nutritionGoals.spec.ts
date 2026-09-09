import { expect, test } from '@nuxt/test-utils/playwright'
import { apiFetch, makeUser, registerViaApi } from './helpers'

interface GoalProfileTarget {
  nutrient: string
  amount: number
  direction: string
  ratioPercent: number | null
}

interface GoalProfile {
  id: number
  name: string
  isDefault: boolean
  targets: GoalProfileTarget[]
}

test('creates a grams profile and echoes directions', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const create = await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Cut',
    inputMode: 'grams',
    isDefault: true,
    targets: [
      { nutrient: 'energy', amount: 1900, direction: 'max' },
      { nutrient: 'protein', amount: 175, direction: 'min' },
      { nutrient: 'fiber', amount: 27 }
    ]
  })
  expect(create.ok).toBe(true)

  const list = await apiFetch<GoalProfile[]>(page, 'GET', '/api/nutrition/goal-profiles')
  const profile = list.json[0]
  const fiber = profile.targets.find((t) => t.nutrient === 'fiber')
  const energy = profile.targets.find((t) => t.nutrient === 'energy')
  expect(fiber!.direction).toBe('min')
  expect(energy!.direction).toBe('max')
})

test('setting a new default clears the old one', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const a = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'A',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 2000 }]
  })
  expect(a.ok).toBe(true)

  const b = await apiFetch<{ id: number }>(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'B',
    inputMode: 'grams',
    isDefault: true,
    targets: [{ nutrient: 'energy', amount: 1800 }]
  })
  expect(b.ok).toBe(true)

  const list = await apiFetch<GoalProfile[]>(page, 'GET', '/api/nutrition/goal-profiles')
  const defaults = list.json.filter((p) => p.isDefault)
  expect(defaults.length).toBe(1)
  expect(defaults[0].name).toBe('B')
})

test('ratio mode stores percentages and derives grams', async ({ page, goto }) => {
  await goto('/', { waitUntil: 'hydration' })
  await registerViaApi(page, makeUser())

  const create = await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Ratio',
    inputMode: 'ratio',
    calories: 2000,
    targets: [
      { nutrient: 'protein', ratioPercent: 40 },
      { nutrient: 'carbohydrate', ratioPercent: 30 },
      { nutrient: 'fat', ratioPercent: 30 }
    ]
  })
  expect(create.ok).toBe(true)

  const list = await apiFetch<GoalProfile[]>(page, 'GET', '/api/nutrition/goal-profiles')
  const profile = list.json.find((p) => p.name === 'Ratio')!
  const protein = profile.targets.find((t) => t.nutrient === 'protein')!
  const carbohydrate = profile.targets.find((t) => t.nutrient === 'carbohydrate')!
  const fat = profile.targets.find((t) => t.nutrient === 'fat')!

  expect(protein.amount).toBeCloseTo(200, 2)
  expect(carbohydrate.amount).toBeCloseTo(150, 2)
  expect(fat.amount).toBeCloseTo(66.667, 2)
  expect(protein.ratioPercent).toBe(40)
  expect(carbohydrate.ratioPercent).toBe(30)
  expect(fat.ratioPercent).toBe(30)

  const bad = await apiFetch(page, 'POST', '/api/nutrition/goal-profiles', {
    name: 'Bad Ratio',
    inputMode: 'ratio',
    calories: 2000,
    targets: [
      { nutrient: 'protein', ratioPercent: 30 },
      { nutrient: 'carbohydrate', ratioPercent: 30 },
      { nutrient: 'fat', ratioPercent: 30 }
    ]
  })
  expect(bad.status).toBe(400)
})
