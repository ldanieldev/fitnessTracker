export const NUTRITION_MACROS = [
  { key: 'energy', name: 'Calories', unit: 'kcal' },
  { key: 'protein', name: 'Protein', unit: 'g' },
  { key: 'carbohydrate', name: 'Carbs', unit: 'g' },
  { key: 'fat', name: 'Fat', unit: 'g' }
] as const

export const DEFAULT_TRACKED_NUTRIENTS = ['energy', 'protein', 'carbohydrate', 'fat', 'fiber'] as const
