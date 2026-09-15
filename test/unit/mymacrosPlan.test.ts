import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/mymacros/${name}`, import.meta.url), 'utf8')
async function load(names: string[]) {
  const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
  return names.map((n) => parseMyMacrosExport(fixture(n), n))
}

describe('planImport', () => {
  it('derives a weight base from gram rows using the largest quantity', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const plan = planImport(await load(['2026-09-04.txt', '2026-09-05.txt']), 1)
    const bread = plan.foods.find((f) => f.name === 'Sourdough Bread')!
    const weight = bread.servings.find((s) => s.kind === 'weight')!
    expect(weight).toMatchObject({ label: 'g', quantity: 100, basisGrams: 100 })
    expect(weight.perUnit.kcal).toBeCloseTo(260, 1) // 63 g → 163.8 kcal ⇒ 2.6/g
    expect(weight.perUnit.protein).toBeCloseTo(10, 1)
    const breadEntry = plan.entries.find((e) => e.foodKey === bread.key)!
    expect(breadEntry.description).toBe('Sourdough Bread')
  })
  it('keeps named units as named servings with per-unit nutrition', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const plan = planImport(await load(['2026-09-04.txt']), 1)
    const egg = plan.foods.find((f) => f.name === 'Large Egg')!
    expect(egg.servings).toEqual([{ kind: 'named', label: 'egg', quantity: 1, basisGrams: null, perUnit: { kcal: 69, protein: 6, carbs: 0, fat: 5 } }])
  })
  it('merges a compound Serving (113 g) row into the same food as its gram rows', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const plan = planImport(await load(['2026-09-05.txt']), 1)
    const cottage = plan.foods.find((f) => f.name === 'Small curd low fat cottage cheese')!
    expect(cottage.servings).toHaveLength(1)
    expect(cottage.servings[0]).toMatchObject({ kind: 'named', label: 'Serving', quantity: 1, basisGrams: 113 })
    expect(cottage.servings[0]!.perUnit.kcal).toBeCloseTo(90.4, 2)
  })
  it('treats ounce-only foods as fluid ounces, never as a weight base', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const plan = planImport(await load(['2026-09-05.txt']), 1)
    const silk = plan.foods.find((f) => f.name === 'Silk Vanilla Almond Milk')!
    expect(silk.servings).toEqual([{ kind: 'named', label: 'fl oz', quantity: 1, basisGrams: null, perUnit: { kcal: 3.3125, protein: 0.125, carbs: 0, fat: 0.3125 } }])
    const entry = plan.entries.find((e) => e.foodKey === silk.key && e.quantity === 8.47)!
    expect(entry).toMatchObject({ unitLabel: 'fl oz', gramsResolved: null, nutrients: { kcal: 28.06, protein: 1.06, carbs: 0, fat: 2.6468751 } })
    expect(plan.warnings.some((w) => w.code === 'oz_as_fluid' && w.message.includes('Silk Vanilla Almond Milk'))).toBe(true)
  })
  it('treats ounces as mass when gram rows of the same food agree', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const text = fixture('2026-09-05.txt').replace('Jasmine Rice (dry)\nServing Size: 50.00 Grams\nTotal Calories: 172.00', 'Jasmine Rice (dry)\nServing Size: 1.7637 Ounces\nTotal Calories: 172.00')
    const plan = planImport([parseMyMacrosExport(text, 'x'), ...(await load(['2026-09-04.txt']))], 1)
    const rice = plan.foods.find((f) => f.name === 'Jasmine Rice (dry)')!
    expect(rice.servings.map((s) => s.kind)).toEqual(['weight'])
    const ozEntry = plan.entries.find((e) => e.foodKey === rice.key && e.unitLabel === 'oz')!
    expect(ozEntry.gramsResolved).toBeCloseTo(50, 1)
  })
  it('falls back to quick_add for an inconsistent group and warns on the checksum', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const plan = planImport(await load(['inconsistent.txt']), 1)
    expect(plan.foods.find((f) => f.name === 'Sourdough Bread')).toBeUndefined()
    expect(plan.entries.every((e) => e.kind === 'quick_add' && e.description === 'Sourdough Bread')).toBe(true)
    expect(plan.warnings.map((w) => w.code).sort()).toEqual(['checksum', 'inconsistent_group'])
  })
  it('folds pound rows into the gram weight basis instead of a separate lb serving', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const lbText = [
      `tester's Daily Meals - 09-06-2026`,
      '',
      '-----------',
      'Meal 1',
      '-----------',
      'Totals',
      'Protein: 22.68',
      'Carbs: 117.93',
      'Fat: 4.54',
      'Calories: 589.67',
      '',
      'Sourdough Bread',
      'Serving Size: 0.50 lb',
      'Total Calories: 589.67',
      'Protein: 22.68',
      'Carbs: 117.93',
      'Total Fat: 4.54',
      '',
      '-----------',
      'Daily Totals',
      '-----------',
      'Protein: 22.68',
      'Carbs: 117.93',
      'Fat: 4.54',
      'Calories: 589.67',
      ''
    ].join('\n')

    const days = [parseMyMacrosExport(lbText, 'lb.txt'), ...(await load(['2026-09-04.txt']))]
    const plan = planImport(days, 1)
    const bread = plan.foods.find((f) => f.name === 'Sourdough Bread')!
    expect(bread.servings.map((s) => s.kind)).toEqual(['weight'])

    const lbEntry = plan.entries.find((e) => e.foodKey === bread.key && e.unitLabel === 'lb')!
    expect(lbEntry).toMatchObject({ kind: 'food', servingLabel: null })
    expect(lbEntry.gramsResolved).toBeCloseTo(226.8, 1)
  })

  it('builds a weight base from lb rows alone when there are no gram rows for that food', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const lbOnlyText = [
      `tester's Daily Meals - 09-06-2026`,
      '',
      '-----------',
      'Meal 1',
      '-----------',
      'Totals',
      'Protein: 22.68',
      'Carbs: 117.93',
      'Fat: 4.54',
      'Calories: 589.67',
      '',
      'Beef Jerky',
      'Serving Size: 0.50 lb',
      'Total Calories: 589.67',
      'Protein: 22.68',
      'Carbs: 117.93',
      'Total Fat: 4.54',
      '',
      '-----------',
      'Daily Totals',
      '-----------',
      'Protein: 22.68',
      'Carbs: 117.93',
      'Fat: 4.54',
      'Calories: 589.67',
      ''
    ].join('\n')

    const plan = planImport([parseMyMacrosExport(lbOnlyText, 'lb2.txt')], 1)
    const jerky = plan.foods.find((f) => f.name === 'Beef Jerky')!
    expect(jerky.servings).toHaveLength(1)
    expect(jerky.servings[0]).toMatchObject({ kind: 'weight', label: 'g', quantity: 100, basisGrams: 100 })
    expect(jerky.servings[0]!.perUnit.kcal).toBeCloseTo(260, 0)

    const entry = plan.entries.find((e) => e.foodKey === jerky.key)!
    expect(entry).toMatchObject({ kind: 'food', servingLabel: null, unitLabel: 'lb' })
    expect(entry.gramsResolved).toBeCloseTo(226.8, 1)
  })

  it('turns an empty named label into quick_add with an unsupported_unit warning instead of throwing', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const text = [
      `tester's Daily Meals - 09-06-2026`,
      '',
      '-----------',
      'Meal 1',
      '-----------',
      'Totals',
      'Protein: 5.00',
      'Carbs: 10.00',
      'Fat: 2.00',
      'Calories: 100.00',
      '',
      'Mystery Bar',
      'Serving Size: 1.00 (113 g)',
      'Total Calories: 100.00',
      'Protein: 5.00',
      'Carbs: 10.00',
      'Total Fat: 2.00',
      '',
      '-----------',
      'Daily Totals',
      '-----------',
      'Protein: 5.00',
      'Carbs: 10.00',
      'Fat: 2.00',
      'Calories: 100.00',
      ''
    ].join('\n')

    const plan = planImport([parseMyMacrosExport(text, 'x.txt')], 1)
    expect(plan.foods.find((f) => f.name === 'Mystery Bar')).toBeUndefined()
    const entry = plan.entries.find((e) => e.description === 'Mystery Bar')!
    expect(entry.kind).toBe('quick_add')
    expect(plan.warnings).toContainEqual({ date: '2026-09-06', code: 'unsupported_unit', message: 'Mystery Bar: unit "" is not supported' })
  })

  it('keeps the disagreement wording for oz_as_fluid when gram rows exist but disagree', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const text = [
      `tester's Daily Meals - 09-06-2026`,
      '',
      '-----------',
      'Meal 1',
      '-----------',
      'Totals',
      'Protein: 4.00',
      'Carbs: 8.00',
      'Fat: 2.00',
      'Calories: 1099.00',
      '',
      'Weird Snack',
      'Serving Size: 50.00 Grams',
      'Total Calories: 100.00',
      'Protein: 2.00',
      'Carbs: 4.00',
      'Total Fat: 1.00',
      '',
      'Weird Snack',
      'Serving Size: 1.00 Ounces',
      'Total Calories: 999.00',
      'Protein: 2.00',
      'Carbs: 4.00',
      'Total Fat: 1.00',
      '',
      '-----------',
      'Daily Totals',
      '-----------',
      'Protein: 4.00',
      'Carbs: 8.00',
      'Fat: 2.00',
      'Calories: 1099.00',
      ''
    ].join('\n')

    const plan = planImport([parseMyMacrosExport(text, 'x.txt')], 1)
    const warning = plan.warnings.find((w) => w.code === 'oz_as_fluid')!
    expect(warning.message).toBe('Weird Snack ounces do not match its gram servings; treating as fluid ounces')
  })

  it('uses the no-gram-rows wording for oz_as_fluid on an ounce-only food', async () => {
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const plan = planImport(await load(['2026-09-05.txt']), 1)
    const warning = plan.warnings.find((w) => w.code === 'oz_as_fluid' && w.message.includes('Silk Vanilla Almond Milk'))!
    expect(warning.message).toBe('Silk Vanilla Almond Milk: ounces imported as fluid ounces (no gram rows to compare against)')
  })

  it('emits deterministic import keys and the containers in first-seen order', async () => {
    const { planImport, importKey } = await import('../../server/utils/nutrition/mymacros/plan')
    const days = await load(['2026-09-04.txt'])
    const a = planImport(days, 1)
    const b = planImport(days, 1)
    expect(a.entries.map((e) => e.importKey)).toEqual(b.entries.map((e) => e.importKey))
    expect(new Set(a.entries.map((e) => e.importKey)).size).toBe(a.entries.length)
    expect(importKey(1, days[0]!.rows[0]!, '2026-09-04')).not.toBe(importKey(2, days[0]!.rows[0]!, '2026-09-04'))
    expect(a.containers).toEqual(['Meal 1', 'Meal 2', 'Meal 3', 'Snack', 'Meal 4'])
  })
})
