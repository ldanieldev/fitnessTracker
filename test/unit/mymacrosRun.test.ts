import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/mymacros/${name}`, import.meta.url), 'utf8')
const nutrientKeys = { energy: 'energy', protein: 'protein', carbohydrate: 'carbohydrate', fat: 'fat' }

describe('toServingInputs', () => {
  it('maps a weight serving to a weight ServingInput', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { toServingInputs } = await import('../../server/utils/nutrition/mymacros/run')

    const days = [
      parseMyMacrosExport(fixture('2026-09-04.txt'), '2026-09-04.txt'),
      parseMyMacrosExport(fixture('2026-09-05.txt'), '2026-09-05.txt')
    ]
    const plan = planImport(days, 1)
    const bread = plan.foods.find((f) => f.name === 'Sourdough Bread')!
    const weight = bread.servings.find((s) => s.kind === 'weight')!

    expect(toServingInputs({ ...bread, servings: [weight] }, nutrientKeys)).toEqual([
      {
        kind: 'weight',
        label: 'g',
        quantity: 100,
        basisGrams: 100,
        nutrients: {
          energy: weight.perUnit.kcal,
          protein: weight.perUnit.protein,
          carbohydrate: weight.perUnit.carbs,
          fat: weight.perUnit.fat
        }
      }
    ])
  })

  it('maps a named serving to a named ServingInput', async () => {
    const { parseMyMacrosExport } = await import('../../server/utils/nutrition/mymacros/parse')
    const { planImport } = await import('../../server/utils/nutrition/mymacros/plan')
    const { toServingInputs } = await import('../../server/utils/nutrition/mymacros/run')

    const days = [parseMyMacrosExport(fixture('2026-09-05.txt'), '2026-09-05.txt')]
    const plan = planImport(days, 1)
    const silk = plan.foods.find((f) => f.name === 'Silk Vanilla Almond Milk')!

    expect(toServingInputs(silk, nutrientKeys)).toEqual([
      {
        kind: 'named',
        label: 'fl oz',
        quantity: 1,
        basisGrams: null,
        nutrients: { energy: 3.3125, protein: 0.125, carbohydrate: 0, fat: 0.3125 }
      }
    ])
  })
})
