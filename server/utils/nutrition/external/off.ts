import type { NutrientKey } from '~~/shared/types/nutrition'
import { parseServingGrams } from './mapExternalFood'
import type { ExternalFood } from './types'
import { ExternalSourceError } from './types'

const PRODUCT_FIELDS = 'code,product_name,brands,serving_size,nutriments'
const SEARCH_FIELDS = 'code,product_name,brands,nutriments,serving_size,lang'
const ATTRIBUTION = 'Open Food Facts — ODbL'
const LATIN_LETTER = /\p{Script=Latin}/u

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
  lang?: string
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

// Keeps a hit with no reported lang, but drops non-English langs and names with no Latin letter (mislabelled lang).
export function isEnglishHit(hit: OffProduct): boolean {
  if (hit.lang !== undefined && hit.lang !== 'en') return false
  return LATIN_LETTER.test(hit.product_name ?? '')
}

export function offHitsToExternal(hits: OffProduct[]): ExternalFood[] {
  return hits.filter(isCompleteHit).filter(isEnglishHit).map(offProductToExternal)
}

function requireUserAgent(): string {
  const userAgent = useRuntimeConfig().off.userAgent
  if (!userAgent) throw new ExternalSourceError('off', 'unconfigured', 'NUXT_OFF_USER_AGENT is not configured')
  return userAgent
}

interface OfetchError extends Error {
  status?: number
  cause?: unknown
}

function isOfetchError(err: unknown): err is OfetchError {
  return err instanceof Error && err.name === 'FetchError'
}

function isAbort(err: OfetchError): boolean {
  return err.cause instanceof Error && err.cause.name === 'AbortError'
}

function mapOffError(err: unknown): ExternalSourceError {
  if (err instanceof ExternalSourceError) return err
  if (isOfetchError(err)) {
    if (isAbort(err)) return new ExternalSourceError('off', 'unavailable', 'Open Food Facts request timed out')
    if (err.status === 429) return new ExternalSourceError('off', 'rate_limited', 'Open Food Facts rate limit exceeded')
    return new ExternalSourceError('off', 'unavailable', `Open Food Facts request failed with HTTP ${err.status}`)
  }
  return new ExternalSourceError('off', 'unavailable', 'Open Food Facts request failed')
}

// $fetch (not global fetch) so a relative NUXT_OFF_PRODUCT_URL/SEARCH_URL (e2e stub) resolves via Nitro's internal dispatch, no network hop.
async function fetchOff<T>(url: string, userAgent: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    return await $fetch<T>(url, { headers: { 'User-Agent': userAgent }, signal: controller.signal, retry: 0 })
  } finally {
    clearTimeout(timer)
  }
}

export async function offByBarcode(code: string): Promise<ExternalFood | null> {
  const userAgent = requireUserAgent()
  const { productUrl } = useRuntimeConfig().off
  try {
    const json = await fetchOff<{ status: number, product?: OffProduct }>(
      `${productUrl}/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS}`,
      userAgent
    )
    if (json.status === 0 || !json.product) return null
    return offProductToExternal(json.product)
  } catch (err) {
    if (isOfetchError(err) && err.status === 404) return null
    throw mapOffError(err)
  }
}

export async function offSearch(q: string, limit: number): Promise<ExternalFood[]> {
  const userAgent = requireUserAgent()
  const { searchUrl } = useRuntimeConfig().off
  try {
    // search-a-licious `langs` scopes which language-specific subfields (e.g. product_name.en) are searched; see its OpenAPI /search docs.
    const json = await fetchOff<{ hits: OffProduct[] }>(
      `${searchUrl}?q=${encodeURIComponent(q)}&page_size=${limit}&fields=${SEARCH_FIELDS}&langs=en`,
      userAgent
    )
    return offHitsToExternal(json.hits)
  } catch (err) {
    throw mapOffError(err)
  }
}
