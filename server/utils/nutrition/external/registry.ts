import type { NutrientKey } from '~~/shared/types/nutrition'
import { cachedBarcode, cachedSearch } from './cache'
import { fatsecretByBarcode, fatsecretById, fatsecretSearch } from './fatsecret'
import { offByBarcode, offSearch } from './off'
import type { ExternalFood, ExternalSourceKey } from './types'
import { ExternalSourceError } from './types'
import { usdaById, usdaByUpc, usdaSearch } from './usda'

export interface ExternalSource {
  key: ExternalSourceKey
  search: (q: string, limit: number) => Promise<ExternalFood[]>
  byBarcode: (code: string) => Promise<ExternalFood | null>
  byId: (id: string) => Promise<ExternalFood | null>
}

export function getExternalSources(): ExternalSource[] {
  const config = useRuntimeConfig()
  const sources: ExternalSource[] = []

  if (config.off.userAgent) {
    sources.push({ key: 'off', search: offSearch, byBarcode: offByBarcode, byId: offByBarcode })
  }
  if (config.usda.apiKey) {
    sources.push({ key: 'usda', search: usdaSearch, byBarcode: usdaByUpc, byId: usdaById })
  }
  if (config.fatsecret.clientId && config.fatsecret.clientSecret) {
    sources.push({ key: 'fatsecret', search: fatsecretSearch, byBarcode: fatsecretByBarcode, byId: fatsecretById })
  }

  // byId (and import, which calls byId) stay uncached — only search and barcode lookups repeat often enough to matter.
  return sources.map((source) => ({
    ...source,
    search: (q: string, limit: number) => cachedSearch(source, q, limit),
    byBarcode: (code: string) => cachedBarcode(source, code)
  }))
}

export interface ExternalSearchResult {
  source: ExternalSourceKey
  externalId: string
  name: string
  brand: string | null
  barcode: string | null
  hasNutrition: boolean
  attribution: string | null
  per100g: Partial<Record<NutrientKey, number>> | null
}

export interface ExternalSearchErrorEntry {
  source: ExternalSourceKey
  kind: ExternalSourceError['kind']
  message: string
}

function toSearchResult(food: ExternalFood): ExternalSearchResult {
  return {
    source: food.source,
    externalId: food.externalId,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    hasNutrition: food.per100g !== null && Object.keys(food.per100g).length > 0,
    attribution: food.attribution,
    per100g: food.per100g
  }
}

export function aggregateExternalResults(
  settled: Array<{ source: ExternalSourceKey, result: PromiseSettledResult<ExternalFood[]> }>
): { results: ExternalSearchResult[], errors: ExternalSearchErrorEntry[] } {
  const results: ExternalSearchResult[] = []
  const errors: ExternalSearchErrorEntry[] = []

  for (const { source, result } of settled) {
    if (result.status === 'fulfilled') {
      results.push(...result.value.map(toSearchResult))
      continue
    }
    const err = result.reason
    if (err instanceof ExternalSourceError) errors.push({ source: err.source, kind: err.kind, message: err.message })
    else errors.push({ source, kind: 'unavailable', message: err instanceof Error ? err.message : 'Unknown error' })
  }

  return { results, errors }
}

export interface BarcodeMatchResult {
  match: ExternalFood | null
  source: ExternalSourceKey | null
  errors: ExternalSearchErrorEntry[]
}

export async function findFirstBarcodeMatch(sources: ExternalSource[], code: string): Promise<BarcodeMatchResult> {
  const errors: ExternalSearchErrorEntry[] = []
  for (const source of sources) {
    try {
      const external = await source.byBarcode(code)
      if (external) return { match: external, source: source.key, errors }
    } catch (err) {
      if (err instanceof ExternalSourceError) {
        errors.push({ source: err.source, kind: err.kind, message: err.message })
        continue
      }
      throw err
    }
  }
  return { match: null, source: null, errors }
}
