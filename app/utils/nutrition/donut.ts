import { ATWATER } from '~~/shared/utils/nutritionDerive'
import { MACRO_CLASS } from './macros'

export type DonutKey = 'protein' | 'carbohydrate' | 'fat'

export interface DonutSlice {
  key: DonutKey
  label: string
  grams: number
  percent: number
  cls: string
}

const LABELS: Record<DonutKey, string> = { protein: 'Protein', carbohydrate: 'Carbs', fat: 'Fat' }

export function macroDonutSlices(nutrients: Record<string, number>): DonutSlice[] {
  const grams: Record<DonutKey, number> = {
    protein: nutrients.protein ?? 0,
    carbohydrate: nutrients.carbohydrate ?? 0,
    fat: nutrients.fat ?? 0
  }
  const calories: Record<DonutKey, number> = {
    protein: grams.protein * ATWATER.protein,
    carbohydrate: grams.carbohydrate * ATWATER.carbohydrate,
    fat: grams.fat * ATWATER.fat
  }
  const total = calories.protein + calories.carbohydrate + calories.fat
  if (!(total > 0)) return []

  const keys = (Object.keys(calories) as DonutKey[]).filter((key) => calories[key] > 0)
  const raw = keys.map((key) => (calories[key] / total) * 100)
  const floored = raw.map(Math.floor)
  const remainder = 100 - floored.reduce((sum, n) => sum + n, 0)
  // Largest-remainder method: hand the leftover percentage points to the slices closest to rounding up, so shares sum to exactly 100.
  const byRemainder = raw
    .map((p, i) => ({ i, frac: p - floored[i]! }))
    .sort((a, b) => b.frac - a.frac)
  const percents = [...floored]
  for (let n = 0; n < remainder; n++) percents[byRemainder[n]!.i]! += 1

  return keys.map((key, i) => ({ key, label: LABELS[key], grams: grams[key], percent: percents[i]!, cls: MACRO_CLASS[key] }))
}
