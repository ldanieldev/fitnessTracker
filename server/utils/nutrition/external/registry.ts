import type { NutrientKey } from '~~/shared/types/nutrition'
import { logger } from '../../logger'
import { cachedBarcode, cachedSearch } from './cache'
import { fatsecretByBarcode, fatsecretById, fatsecretSearch } from './fatsecret'
import { offByBarcode, offSearch } from './off'
import type { ExternalFood, ExternalSourceKey } from './types'
import { ExternalSourceError } from './types'
import { usdaById, usdaByUpc, usdaSearch } from './usda'

const log = logger.child({ component: 'food-sources' })

export interface ExternalSource {
  key: ExternalSourceKey
  search: (q: string, limit: number) => Promise<ExternalFood[]>
  byBarcode: (code: string) => Promise<ExternalFood | null>
  byId: (id: string) => Promise<ExternalFood | null>
}

export function configuredExternalSources(): ExternalSource[] {
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

  return sources
}

export function getExternalSources(): ExternalSource[] {
  // byId (and import, which calls byId) stay uncached — only search and barcode lookups repeat often enough to matter.
  return configuredExternalSources().map((raw) => {
    const source = withSourceLogging(raw)
    return {
      ...source,
      search: (q: string, limit: number) => cachedSearch(source, q, limit),
      byBarcode: (code: string) => cachedBarcode(source, code)
    }
  })
}

type SourceOp = 'search' | 'byBarcode' | 'byId'

const FAILURE_LOG_INTERVAL_MS = 60_000
const failureLogState = new Map<string, { at: number; suppressed: number }>()

export function resetExternalSourceLogThrottle(): void {
  failureLogState.clear()
}

// At most one line per source/op/failure a minute, so an upstream outage does not log once per search request.
function claimFailureLog(key: string): { suppressed: number } | null {
  const now = Date.now()
  const state = failureLogState.get(key)
  if (state && now - state.at < FAILURE_LOG_INTERVAL_MS) {
    state.suppressed++
    return null
  }
  failureLogState.set(key, { at: now, suppressed: 0 })
  return { suppressed: state?.suppressed ?? 0 }
}

function logSourceFailure(source: ExternalSourceKey, op: SourceOp, err: unknown, durationMs: number): void {
  if (!(err instanceof ExternalSourceError)) {
    const errName = err instanceof Error ? err.name : typeof err
    const claim = claimFailureLog(`${source}:${op}:unexpected:${errName}`)
    if (claim) log.warn({ source, op, kind: 'unexpected', errName, durationMs, ...claim }, 'food source request failed')
    return
  }
  const { status, apiCode, misconfigured } = err.detail
  const claim = claimFailureLog(`${source}:${op}:${err.kind}:${status ?? ''}:${apiCode ?? ''}`)
  if (!claim) return
  const fields = { source, op, kind: err.kind, status, apiCode, durationMs, ...claim }
  if (misconfigured || err.kind === 'unconfigured') log.error(fields, 'food source misconfigured')
  else log.warn(fields, 'food source request failed')
}

async function timed<T>(source: ExternalSourceKey, op: SourceOp, count: (r: T) => number, run: () => Promise<T>) {
  const started = performance.now()
  try {
    const result = await run()
    log.debug(
      { source, op, results: count(result), durationMs: Math.round(performance.now() - started) },
      'food source request succeeded'
    )
    return result
  } catch (err) {
    logSourceFailure(source, op, err, Math.round(performance.now() - started))
    throw err
  }
}

const foundCount = (food: ExternalFood | null) => (food ? 1 : 0)

export function withSourceLogging(source: ExternalSource): ExternalSource {
  return {
    key: source.key,
    search: (q, limit) => timed(source.key, 'search', (foods) => foods.length, () => source.search(q, limit)),
    byBarcode: (code) => timed(source.key, 'byBarcode', foundCount, () => source.byBarcode(code)),
    byId: (id) => timed(source.key, 'byId', foundCount, () => source.byId(id))
  }
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
  settled: Array<{ source: ExternalSourceKey; result: PromiseSettledResult<ExternalFood[]> }>
): { results: ExternalSearchResult[]; errors: ExternalSearchErrorEntry[] } {
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
