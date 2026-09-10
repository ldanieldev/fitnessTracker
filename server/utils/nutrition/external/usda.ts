import type { NutrientKey } from '~~/shared/types/nutrition'
import { fetchJson, HttpStatusError } from './http'
import type { ExternalFood } from './types'
import { ExternalSourceError } from './types'

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const SEARCH_DATA_TYPES = 'Branded,Foundation,SR%20Legacy'
const ATTRIBUTION = 'USDA FoodData Central (public domain)'

export const USDA_NUTRIENT_NUMBERS: Record<string, NutrientKey> = {
  '208': 'energy',
  '203': 'protein',
  '205': 'carbohydrate',
  '204': 'fat',
  '291': 'fiber',
  '269': 'sugar',
  '606': 'saturatedFat',
  '601': 'cholesterol',
  '307': 'sodium',
  '306': 'potassium'
}

const EXPECTED_UNITS: Record<NutrientKey, string> = {
  energy: 'kcal',
  protein: 'g',
  carbohydrate: 'g',
  fat: 'g',
  fiber: 'g',
  sugar: 'g',
  saturatedFat: 'g',
  cholesterol: 'mg',
  sodium: 'mg',
  potassium: 'mg'
}

interface UsdaSearchNutrient {
  nutrientNumber: string
  value: number
  unitName: string
}

interface UsdaDetailNutrient {
  amount: number
  nutrient: { number: string, unitName: string }
}

type UsdaFoodNutrient = UsdaSearchNutrient | UsdaDetailNutrient

interface UsdaFood {
  fdcId: number
  description: string
  brandOwner?: string
  gtinUpc?: string
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  foodNutrients?: UsdaFoodNutrient[]
}

interface UsdaSearchResponse {
  foods: UsdaFood[]
}

function normalizeNutrient(n: UsdaFoodNutrient): { number: string, value: number, unit: string } {
  if ('nutrient' in n) return { number: n.nutrient.number, value: n.amount, unit: n.nutrient.unitName }
  return { number: n.nutrientNumber, value: n.value, unit: n.unitName }
}

function mapFoodNutrients(foodNutrients: UsdaFoodNutrient[] | undefined): Partial<Record<NutrientKey, number>> | null {
  if (!foodNutrients) return null
  const per100g: Partial<Record<NutrientKey, number>> = {}
  for (const raw of foodNutrients) {
    const { number, value, unit } = normalizeNutrient(raw)
    const key = USDA_NUTRIENT_NUMBERS[number]
    if (!key) continue
    if (unit.toLowerCase() !== EXPECTED_UNITS[key]) continue
    per100g[key] = value
  }
  return per100g
}

function stripLeadingZeros(code: string): string {
  return code.replace(/^0+/, '')
}

export function usdaHitToExternal(food: UsdaFood): ExternalFood {
  const servingGrams = food.servingSizeUnit?.toLowerCase() === 'g' && typeof food.servingSize === 'number'
    ? food.servingSize
    : null
  return {
    source: 'usda',
    externalId: String(food.fdcId),
    name: food.description,
    brand: food.brandOwner ?? null,
    barcode: food.gtinUpc ?? null,
    per100g: mapFoodNutrients(food.foodNutrients),
    servingGrams,
    servingLabel: servingGrams ? (food.householdServingFullText ?? 'serving') : null,
    attribution: ATTRIBUTION
  }
}

function requireApiKey(): string {
  const apiKey = useRuntimeConfig().usda.apiKey
  if (!apiKey) throw new ExternalSourceError('usda', 'unconfigured', 'NUXT_USDA_API_KEY is not configured')
  return apiKey
}

function mapUsdaError(err: unknown): ExternalSourceError {
  if (err instanceof ExternalSourceError) return err
  if (err instanceof HttpStatusError) {
    if (err.status === 429) return new ExternalSourceError('usda', 'rate_limited', 'USDA FoodData Central rate limit exceeded')
    return new ExternalSourceError('usda', 'unavailable', `USDA FoodData Central request failed with HTTP ${err.status}`)
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return new ExternalSourceError('usda', 'unavailable', 'USDA FoodData Central request timed out')
  }
  return new ExternalSourceError('usda', 'unavailable', 'USDA FoodData Central request failed')
}

export async function usdaSearch(q: string, limit: number): Promise<ExternalFood[]> {
  const apiKey = requireApiKey()
  try {
    const json = await fetchJson<UsdaSearchResponse>(
      `${BASE_URL}/foods/search?api_key=${apiKey}&query=${encodeURIComponent(q)}&pageSize=${limit}&dataType=${SEARCH_DATA_TYPES}`
    )
    return json.foods.map(usdaHitToExternal)
  } catch (err) {
    throw mapUsdaError(err)
  }
}

export async function usdaById(fdcId: string): Promise<ExternalFood | null> {
  const apiKey = requireApiKey()
  try {
    const json = await fetchJson<UsdaFood>(`${BASE_URL}/food/${encodeURIComponent(fdcId)}?api_key=${apiKey}`)
    return usdaHitToExternal(json)
  } catch (err) {
    if (err instanceof HttpStatusError && err.status === 404) return null
    throw mapUsdaError(err)
  }
}

export async function usdaByUpc(code: string): Promise<ExternalFood | null> {
  const apiKey = requireApiKey()
  try {
    const json = await fetchJson<UsdaSearchResponse>(
      `${BASE_URL}/foods/search?api_key=${apiKey}&query=${encodeURIComponent(code)}&dataType=Branded`
    )
    const stripped = stripLeadingZeros(code)
    const hit = json.foods.find((food) => food.gtinUpc && stripLeadingZeros(food.gtinUpc) === stripped)
    return hit ? usdaHitToExternal(hit) : null
  } catch (err) {
    throw mapUsdaError(err)
  }
}
