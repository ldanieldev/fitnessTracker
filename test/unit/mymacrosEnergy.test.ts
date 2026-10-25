import { describe, expect, it } from 'vitest'
import { energyWarnings, entryEnergy } from '../../server/utils/nutrition/mymacros/energy'
import type { PlannedEntry, PlannedFood } from '../../server/utils/nutrition/mymacros/plan'

const entry = (date: string, foodKey: string): PlannedEntry => ({
  date,
  container: 'Snacks',
  ordinal: 0,
  importKey: `${date}${foodKey}`,
  kind: 'food',
  foodKey,
  servingLabel: null,
  quantity: 1,
  unitLabel: 'g',
  gramsResolved: 1,
  nutrients: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  description: null
})

describe('entryEnergy', () => {
  it('calculates food entries from the macros', () => {
    const kcal = entryEnergy({ kind: 'food', nutrients: { kcal: 85, protein: 0.15, carbs: 2.55, fat: 1.65 } })
    expect(kcal).toBeCloseTo(25.65)
  })

  it('keeps the quick add kcal', () => {
    expect(entryEnergy({ kind: 'quick_add', nutrients: { kcal: 85, protein: 0.15, carbs: 2.55, fat: 1.65 } })).toBe(85)
  })
})

describe('energyWarnings', () => {
  const biscoff: PlannedFood = {
    key: 'biscoff',
    name: 'Biscoff',
    servings: [
      {
        kind: 'weight',
        label: 'g',
        quantity: 1,
        basisGrams: null,
        perUnit: { kcal: 5.667, protein: 0.01, carbs: 0.17, fat: 0.11 }
      }
    ]
  }

  it('warns once per mismatched serving, dated by the earliest entry', () => {
    const warnings = energyWarnings([biscoff], [entry('2026-09-02', 'biscoff'), entry('2026-09-01', 'biscoff')])
    expect(warnings).toEqual([
      {
        date: '2026-09-01',
        code: 'energy_mismatch',
        message: 'Biscoff (g): My Macros+ says 567 kcal, the macros give 171. Check the macros against the label.'
      }
    ])
  })

  it('compares a per-100 g weight serving as is', () => {
    const food: PlannedFood = {
      ...biscoff,
      servings: [{ ...biscoff.servings[0]!, quantity: 100, perUnit: { kcal: 566.7, protein: 1, carbs: 17, fat: 11 } }]
    }
    expect(energyWarnings([food], [entry('2026-09-01', 'biscoff')])).toHaveLength(1)
  })

  it('compares a named serving at one unit', () => {
    const food: PlannedFood = {
      key: 'bar',
      name: 'Bar',
      servings: [
        {
          kind: 'named',
          label: 'bar',
          quantity: 1,
          basisGrams: null,
          perUnit: { kcal: 300, protein: 5, carbs: 20, fat: 5 }
        }
      ]
    }
    expect(energyWarnings([food], [entry('2026-09-01', 'bar')])[0]?.message).toBe(
      'Bar (bar): My Macros+ says 300 kcal, the macros give 145. Check the macros against the label.'
    )
  })

  it('stays quiet for a consistent food', () => {
    const food: PlannedFood = {
      key: 'oats',
      name: 'Oats',
      servings: [
        {
          kind: 'weight',
          label: 'g',
          quantity: 100,
          basisGrams: 100,
          perUnit: { kcal: 380, protein: 13, carbs: 60, fat: 9 }
        }
      ]
    }
    expect(energyWarnings([food], [entry('2026-09-01', 'oats')])).toEqual([])
  })
})
