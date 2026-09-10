import type { NutrientKey } from '~~/shared/types/nutrition'
import { fetchJson, HttpStatusError } from './http'
import { parseServingGrams } from './mapExternalFood'
import type { ExternalFood } from './types'
import { ExternalSourceError } from './types'

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product'
const SEARCH_URL = 'https://search.openfoodfacts.org/search'
const PRODUCT_FIELDS = 'code,product_name,brands,serving_size,nutriments'
const SEARCH_FIELDS = 'code,product_name,brands,nutriments,serving_size'
const ATTRIBUTION = 'Open Food Facts — ODbL'

interface OffNutriments {
  'energy-kcal_100g'?: number
  proteins_100g?: number
  carbohydrates_100g?: number
  fat_100g?: number
  fiber_100g?: number
  sugars_100g?: number
  'saturated-fat_100g'?: number
  sodium_100g?: number
  salt_100g?: number
}

interface OffProduct {
  code?: string
  product_name?: string
  brands?: string | string[]
  serving_size?: string
  nutriments?: OffNutriments
}

function firstBrand(brands: string | string[] | undefined): string | null {
  if (!brands) return null
  const first = Array.isArray(brands) ? brands[0] : brands.split(',')[0]
  return first?.trim() || null
}

function mapNutriments(n: OffNutriments | undefined): Partial<Record<NutrientKey, number>> | null {
  if (!n) return null
  const per100g: Partial<Record<NutrientKey, number>> = {}
  if (n['energy-kcal_100g'] !== undefined) per100g.energy = n['energy-kcal_100g']
  if (n.proteins_100g !== undefined) per100g.protein = n.proteins_100g
  if (n.carbohydrates_100g !== undefined) per100g.carbohydrate = n.carbohydrates_100g
  if (n.fat_100g !== undefined) per100g.fat = n.fat_100g
  if (n.fiber_100g !== undefined) per100g.fiber = n.fiber_100g
  if (n.sugars_100g !== undefined) per100g.sugar = n.sugars_100g
  if (n['saturated-fat_100g'] !== undefined) per100g.saturatedFat = n['saturated-fat_100g']
  // OFF reports sodium and salt in grams; the catalogue's sodium unit is mg. Fall back to salt × 400 (salt g / 2.5 * 1000) when sodium is absent.
  if (n.sodium_100g !== undefined) per100g.sodium = n.sodium_100g * 1000
  else if (n.salt_100g !== undefined) per100g.sodium = n.salt_100g * 400
  return per100g
}

export function offProductToExternal(product: OffProduct): ExternalFood {
  const code = product.code ?? ''
  return {
    source: 'off',
    externalId: code,
    name: product.product_name ?? '',
    brand: firstBrand(product.brands),
    barcode: code || null,
    per100g: mapNutriments(product.nutriments),
    servingGrams: parseServingGrams(product.serving_size ?? null),
    servingLabel: product.serving_size ? 'serving' : null,
    attribution: ATTRIBUTION
  }
}

function isCompleteHit(hit: OffProduct): boolean {
  return typeof hit.code === 'string' && hit.code.length > 0 &&
    typeof hit.product_name === 'string' && hit.product_name.trim().length > 0
}

export function offHitsToExternal(hits: OffProduct[]): ExternalFood[] {
  return hits.filter(isCompleteHit).map(offProductToExternal)
}

function requireUserAgent(): string {
  const userAgent = useRuntimeConfig().off.userAgent
  if (!userAgent) throw new ExternalSourceError('off', 'unconfigured', 'NUXT_OFF_USER_AGENT is not configured')
  return userAgent
}

function mapOffError(err: unknown): ExternalSourceError {
  if (err instanceof ExternalSourceError) return err
  if (err instanceof HttpStatusError) {
    if (err.status === 429) return new ExternalSourceError('off', 'rate_limited', 'Open Food Facts rate limit exceeded')
    return new ExternalSourceError('off', 'unavailable', `Open Food Facts request failed with HTTP ${err.status}`)
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return new ExternalSourceError('off', 'unavailable', 'Open Food Facts request timed out')
  }
  return new ExternalSourceError('off', 'unavailable', 'Open Food Facts request failed')
}

export async function offByBarcode(code: string): Promise<ExternalFood | null> {
  const userAgent = requireUserAgent()
  try {
    const json = await fetchJson<{ status: number, product?: OffProduct }>(
      `${PRODUCT_URL}/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS}`,
      { headers: { 'User-Agent': userAgent } }
    )
    if (json.status === 0 || !json.product) return null
    return offProductToExternal(json.product)
  } catch (err) {
    if (err instanceof HttpStatusError && err.status === 404) return null
    throw mapOffError(err)
  }
}

export async function offSearch(q: string, limit: number): Promise<ExternalFood[]> {
  const userAgent = requireUserAgent()
  try {
    const json = await fetchJson<{ hits: OffProduct[] }>(
      `${SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=${limit}&fields=${SEARCH_FIELDS}`,
      { headers: { 'User-Agent': userAgent } }
    )
    return offHitsToExternal(json.hits)
  } catch (err) {
    throw mapOffError(err)
  }
}
