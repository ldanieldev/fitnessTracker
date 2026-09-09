import { sql } from 'drizzle-orm'
import type { NutrientUnit, TargetDirection } from '../../../shared/types/nutrition'
import { db } from '../../utils/db'
import { mealContainers, nutrients } from '../schema'

export interface NutrientSeed {
  key: string
  name: string
  unit: NutrientUnit
  isMacro: boolean
  defaultDirection: TargetDirection
  sortOrder: number
}

export const NUTRIENT_SEED: NutrientSeed[] = [
  { key: 'energy', name: 'Calories', unit: 'kcal', isMacro: true, defaultDirection: 'max', sortOrder: 0 },
  { key: 'protein', name: 'Protein', unit: 'g', isMacro: true, defaultDirection: 'min', sortOrder: 1 },
  { key: 'carbohydrate', name: 'Carbs', unit: 'g', isMacro: true, defaultDirection: 'max', sortOrder: 2 },
  { key: 'fat', name: 'Fat', unit: 'g', isMacro: true, defaultDirection: 'max', sortOrder: 3 },
  { key: 'fiber', name: 'Fiber', unit: 'g', isMacro: false, defaultDirection: 'min', sortOrder: 4 },
  { key: 'sugar', name: 'Sugar', unit: 'g', isMacro: false, defaultDirection: 'max', sortOrder: 5 },
  { key: 'saturatedFat', name: 'Saturated Fat', unit: 'g', isMacro: false, defaultDirection: 'max', sortOrder: 6 },
  { key: 'cholesterol', name: 'Cholesterol', unit: 'mg', isMacro: false, defaultDirection: 'max', sortOrder: 7 },
  { key: 'sodium', name: 'Sodium', unit: 'mg', isMacro: false, defaultDirection: 'max', sortOrder: 8 },
  { key: 'potassium', name: 'Potassium', unit: 'mg', isMacro: false, defaultDirection: 'min', sortOrder: 9 }
]

export const CONTAINER_SEED = ['Meal 1', 'Meal 2', 'Meal 3', 'Meal 4', 'Meal 5', 'Snack']

export async function seedNutrients() {
  await db
    .insert(nutrients)
    .values(NUTRIENT_SEED)
    .onConflictDoUpdate({
      target: nutrients.key,
      set: {
        name: sql`excluded.name`,
        unit: sql`excluded.unit`,
        isMacro: sql`excluded.is_macro`,
        defaultDirection: sql`excluded.default_direction`,
        sortOrder: sql`excluded.sort_order`
      }
    })
}

export async function seedContainersForUser(userId: number) {
  await db
    .insert(mealContainers)
    .values(CONTAINER_SEED.map((name, i) => ({ userId, name, sortOrder: i })))
    .onConflictDoNothing()
}
