import type { NutrientKey } from '~~/shared/types/nutrition'
import { fetchJson, HttpStatusError } from './http'
import type { ExternalFood } from './types'
import { ExternalSourceError } from './types'

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token'
const API_URL = 'https://platform.fatsecret.com/rest/server.api'
const ATTRIBUTION = 'FatSecret Platform API'

interface FatsecretServing {
  serving_description?: string
  metric_serving_amount?: string
  metric_serving_unit?: string
  calories?: string
  protein?: string
  carbohydrate?: string
  fat?: string
  fiber?: string
  sugar?: string
  saturated_fat?: string
  cholesterol?: string
  sodium?: string
  potassium?: string
  is_default?: string
}

interface FatsecretFood {
  food_id: string
  food_name: string
  brand_name?: string
  servings?: { serving?: FatsecretServing[] | FatsecretServing }
}

interface FatsecretSearchHit {
  food_id: string
  food_name: string
  brand_name?: string
}

function toArray<T>(value: T[] | T | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}

function pickServing(servings: FatsecretServing[]): FatsecretServing | undefined {
  return servings.find((s) => s.is_default === '1') ?? servings[0]
}

function mapServingToPer100g(serving: FatsecretServing | undefined): Partial<Record<NutrientKey, number>> | null {
  if (!serving || serving.metric_serving_unit?.toLowerCase() !== 'g') return null
  const amount = Number(serving.metric_serving_amount)
  if (!amount) return null
  const scale = 100 / amount
  const per100g: Partial<Record<NutrientKey, number>> = {}
  const assign = (key: NutrientKey, raw: string | undefined) => {
    if (raw === undefined) return
    per100g[key] = Number(raw) * scale
  }
  assign('energy', serving.calories)
  assign('protein', serving.protein)
  assign('carbohydrate', serving.carbohydrate)
  assign('fat', serving.fat)
  assign('fiber', serving.fiber)
  assign('sugar', serving.sugar)
  assign('saturatedFat', serving.saturated_fat)
  assign('cholesterol', serving.cholesterol)
  assign('sodium', serving.sodium)
  assign('potassium', serving.potassium)
  return per100g
}

export function fatsecretFoodToExternal(food: FatsecretFood): ExternalFood {
  const servings = toArray(food.servings?.serving)
  const serving = pickServing(servings)
  const isGrams = serving?.metric_serving_unit?.toLowerCase() === 'g'
  return {
    source: 'fatsecret',
    externalId: String(food.food_id),
    name: food.food_name,
    brand: food.brand_name ?? null,
    barcode: null,
    per100g: mapServingToPer100g(serving),
    servingGrams: isGrams ? Number(serving!.metric_serving_amount) : null,
    servingLabel: serving?.serving_description ?? null,
    attribution: ATTRIBUTION
  }
}

let cachedToken: { token: string, expiresAt: number } | null = null
let pendingToken: Promise<string> | null = null

function requireCredentials(): { clientId: string, clientSecret: string, scope: string } {
  const { clientId, clientSecret, scope } = useRuntimeConfig().fatsecret
  if (!clientId || !clientSecret) {
    throw new ExternalSourceError('fatsecret', 'unconfigured', 'NUXT_FATSECRET_CLIENT_ID/_SECRET is not configured')
  }
  return { clientId, clientSecret, scope }
}

// FatSecret reports API errors (bad params, IP not whitelisted, etc.) as HTTP 200 with an {error: {code, message}} body.
class FatsecretApiError extends Error {
  constructor(public readonly code: number, message: string) {
    super(message)
    this.name = 'FatsecretApiError'
  }
}

function mapFatsecretError(err: unknown): ExternalSourceError {
  if (err instanceof ExternalSourceError) return err
  if (err instanceof FatsecretApiError) {
    return new ExternalSourceError('fatsecret', 'unavailable', `FatSecret API error ${err.code}: ${err.message}`)
  }
  if (err instanceof HttpStatusError) {
    if (err.status === 429) return new ExternalSourceError('fatsecret', 'rate_limited', 'FatSecret rate limit exceeded')
    return new ExternalSourceError('fatsecret', 'unavailable', `FatSecret request failed with HTTP ${err.status}`)
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return new ExternalSourceError('fatsecret', 'unavailable', 'FatSecret request timed out')
  }
  return new ExternalSourceError('fatsecret', 'unavailable', 'FatSecret request failed')
}

async function requestToken(): Promise<string> {
  const { clientId, clientSecret, scope } = requireCredentials()
  const json = await fetchJson<{ access_token: string, expires_in: number }>(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=client_credentials&scope=${scope}`
  })
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 }
  return cachedToken.token
}

function clearPendingToken(): void {
  pendingToken = null
}

export async function getFatsecretToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  if (!pendingToken) pendingToken = requestToken().finally(clearPendingToken)
  return pendingToken
}

async function fatsecretGet<T>(query: string): Promise<T> {
  const token = await getFatsecretToken()
  const json = await fetchJson<T & { error?: { code: number, message: string } }>(
    `${API_URL}?${query}&format=json`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (json.error) throw new FatsecretApiError(json.error.code, json.error.message)
  return json
}

export async function fatsecretById(foodId: string): Promise<ExternalFood | null> {
  requireCredentials()
  try {
    const json = await fatsecretGet<{ food: FatsecretFood }>(`method=food.get.v4&food_id=${encodeURIComponent(foodId)}`)
    return fatsecretFoodToExternal(json.food)
  } catch (err) {
    if (err instanceof HttpStatusError && err.status === 404) return null
    throw mapFatsecretError(err)
  }
}

export async function fatsecretSearch(q: string, limit: number): Promise<ExternalFood[]> {
  requireCredentials()
  try {
    const json = await fatsecretGet<{ foods?: { food?: FatsecretSearchHit[] | FatsecretSearchHit } }>(
      `method=foods.search&search_expression=${encodeURIComponent(q)}&max_results=${limit}`
    )
    const hits = toArray(json.foods?.food)
    const foods = await Promise.all(hits.map((hit) => fatsecretById(hit.food_id)))
    return foods.filter((food): food is ExternalFood => food !== null)
  } catch (err) {
    throw mapFatsecretError(err)
  }
}

export async function fatsecretByBarcode(code: string): Promise<ExternalFood | null> {
  requireCredentials()
  const gtin13 = code.length === 12 ? `0${code}` : code
  try {
    const json = await fatsecretGet<{ food_id?: { value?: string } | string }>(
      `method=food.find_id_for_barcode&barcode=${encodeURIComponent(gtin13)}`
    )
    const foodId = typeof json.food_id === 'string' ? json.food_id : json.food_id?.value
    if (!foodId || foodId === '0') return null
    return fatsecretById(foodId)
  } catch (err) {
    throw mapFatsecretError(err)
  }
}
