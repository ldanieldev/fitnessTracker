import { describe, expect, it } from 'vitest'
import type { NutrientCatalogEntry } from '../../server/utils/nutrition/goalInput'

const catalog: NutrientCatalogEntry[] = [
  { id: 1, key: 'energy', name: 'Calories', unit: 'kcal', isMacro: true, defaultDirection: 'max', sortOrder: 0 },
  { id: 2, key: 'protein', name: 'Protein', unit: 'g', isMacro: true, defaultDirection: 'min', sortOrder: 1 },
  { id: 3, key: 'carbohydrate', name: 'Carbohydrate', unit: 'g', isMacro: true, defaultDirection: 'target', sortOrder: 2 },
  { id: 4, key: 'fat', name: 'Fat', unit: 'g', isMacro: true, defaultDirection: 'target', sortOrder: 3 }
]

describe('buildGoalTargetRows', () => {
  it('maps grams-mode targets to nutrient rows as given', async () => {
    const { buildGoalTargetRows } = await import('../../server/utils/nutrition/goalInput')
    const rows = buildGoalTargetRows(
      { name: 'Cut', inputMode: 'grams', calories: null, isDefault: false, targets: [{ nutrient: 'protein', amount: 175, direction: 'min' }] },
      catalog
    )
    expect(rows).toEqual([{ nutrientId: 2, amount: 175, direction: 'min', ratioPercent: null }])
  })

  it('passes calories through to the appended energy row', async () => {
    const { buildGoalTargetRows } = await import('../../server/utils/nutrition/goalInput')
    const rows = buildGoalTargetRows(
      {
        name: 'Cut',
        inputMode: 'grams',
        calories: 2200,
        isDefault: false,
        targets: [
          { nutrient: 'protein', amount: 175, direction: 'min' },
          { nutrient: 'carbohydrate', amount: 165, direction: 'target' },
          { nutrient: 'fat', amount: 60, direction: 'target' }
        ]
      },
      catalog
    )
    expect(rows.at(-1)).toEqual({ nutrientId: 1, amount: 2200, direction: 'max', ratioPercent: null })
  })
})
