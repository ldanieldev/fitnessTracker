import { describe, expect, it } from 'vitest'
import type { NutrientCatalogEntry } from '../../server/utils/nutrition/nutrientIds'

const catalog: NutrientCatalogEntry[] = [
  { id: 1, key: 'energy', name: 'Calories', unit: 'kcal', isMacro: true, defaultDirection: 'max', sortOrder: 0 },
  { id: 2, key: 'protein', name: 'Protein', unit: 'g', isMacro: true, defaultDirection: 'min', sortOrder: 1 },
  { id: 3, key: 'carbohydrate', name: 'Carbs', unit: 'g', isMacro: true, defaultDirection: 'max', sortOrder: 2 },
  { id: 4, key: 'fat', name: 'Fat', unit: 'g', isMacro: true, defaultDirection: 'max', sortOrder: 3 },
  { id: 5, key: 'fiber', name: 'Fiber', unit: 'g', isMacro: false, defaultDirection: 'min', sortOrder: 4 },
  { id: 6, key: 'sodium', name: 'Sodium', unit: 'mg', isMacro: false, defaultDirection: 'max', sortOrder: 8 }
]

describe('defaultTrackedNutrients', () => {
  it('tracks the four macros plus fiber, in that order, with contiguous sort orders', async () => {
    const { defaultTrackedNutrients } = await import('../../server/utils/nutrition/nutrientIds')
    const rows = defaultTrackedNutrients(catalog)
    expect(rows.map((r) => r.key)).toEqual(['energy', 'protein', 'carbohydrate', 'fat', 'fiber'])
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 1, 2, 3, 4])
  })

  it('carries name and unit from the catalog rather than hardcoding them', async () => {
    const { defaultTrackedNutrients } = await import('../../server/utils/nutrition/nutrientIds')
    const rows = defaultTrackedNutrients(catalog)
    const fiber = rows.find((r) => r.key === 'fiber')!
    expect(fiber.name).toBe('Fiber')
    expect(fiber.unit).toBe('g')
  })

  it('throws if a default key is missing from the catalog', async () => {
    const { defaultTrackedNutrients } = await import('../../server/utils/nutrition/nutrientIds')
    const incomplete = catalog.filter((n) => n.key !== 'fiber')
    expect(() => defaultTrackedNutrients(incomplete)).toThrow('fiber')
  })
})
