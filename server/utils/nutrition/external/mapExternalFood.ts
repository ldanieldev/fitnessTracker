import type { NutrientKey } from '~~/shared/types/nutrition'
import { toGtin13 } from '~~/shared/utils/gtin'
import type { ServingInput } from '../foodInput'
import type { ExternalFood } from './types'

const NUTRIENT_KEYS: ReadonlySet<NutrientKey> = new Set([
  'energy', 'protein', 'carbohydrate', 'fat', 'fiber', 'sugar', 'saturatedFat', 'cholesterol', 'sodium', 'potassium'
])

// Matches the first "(NN g)" or leading "NN g"/"NNg"; anything in ml is not a weight and returns null.
const GRAMS = /(?:^|\()\s*(\d+(?:[.,]\d+)?)\s*g\b/i

export function parseServingGrams(raw: string | null): number | null {
  if (!raw) return null
  const m = GRAMS.exec(raw)
  return m ? Number(m[1]!.replace(',', '.')) : null
}

function filterCatalogueNutrients(
  per100g: Partial<Record<NutrientKey, number>>
): Partial<Record<NutrientKey, number>> {
  const filtered: Partial<Record<NutrientKey, number>> = {}
  for (const [key, value] of Object.entries(per100g)) {
    if (NUTRIENT_KEYS.has(key as NutrientKey)) filtered[key as NutrientKey] = value
  }
  return filtered
}

export function mapExternalFood(
  food: ExternalFood
): { name: string, brand: string | null, barcode: string | null, servings: ServingInput[] } {
  const servings: ServingInput[] = []
  if (food.per100g) {
    servings.push({ kind: 'weight', label: 'g', quantity: 100, nutrients: filterCatalogueNutrients(food.per100g) })
    if (food.servingGrams && food.servingGrams > 0) {
      servings.push({ kind: 'named', label: food.servingLabel ?? 'serving', quantity: 1, basisGrams: food.servingGrams })
    }
  }
  return { name: food.name, brand: food.brand, barcode: food.barcode ? toGtin13(food.barcode) : null, servings }
}
