import { ATWATER } from './nutritionDerive'

export const RATIO_MACROS = ['protein', 'carbohydrate', 'fat'] as const

export interface MacroRatios {
  protein: number
  carbohydrate: number
  fat: number
}

export function ratioToGrams(calories: number, ratios: MacroRatios): Record<string, number> {
  if (!(calories > 0)) {
    throw new Error('Calories must be positive')
  }
  const sum = ratios.protein + ratios.carbohydrate + ratios.fat
  if (Math.abs(sum - 100) > 0.5) {
    throw new Error(`Macro ratios must sum to 100, got ${sum}`)
  }
  return {
    protein: (calories * ratios.protein) / 100 / ATWATER.protein,
    carbohydrate: (calories * ratios.carbohydrate) / 100 / ATWATER.carbohydrate,
    fat: (calories * ratios.fat) / 100 / ATWATER.fat
  }
}
