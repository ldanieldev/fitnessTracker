import type { ExternalFood } from './types'
import type { ExternalSource } from './registry'

// FatSecret/OFF/USDA results change rarely; a day-long cache keeps repeat searches and barcode lookups off the network.
const MAX_AGE = 60 * 60 * 24

// Built lazily, not at module load, so importing this file never requires Nitro's defineCachedFunction to exist (plain unit tests don't provide it).
let searchImpl: ((source: ExternalSource, q: string, limit: number) => Promise<ExternalFood[]>) | undefined
let barcodeImpl: ((source: ExternalSource, code: string) => Promise<ExternalFood | null>) | undefined

export function cachedSearch(source: ExternalSource, q: string, limit: number): Promise<ExternalFood[]> {
  searchImpl ??= defineCachedFunction(
    (s: ExternalSource, query: string, lim: number) => s.search(query, lim),
    {
      name: 'external-search',
      maxAge: MAX_AGE,
      swr: false,
      getKey: (s: ExternalSource, query: string, lim: number) => `${s.key}:${lim}:${query.trim().toLowerCase()}`
    }
  )
  return searchImpl(source, q, limit)
}

export function cachedBarcode(source: ExternalSource, code: string): Promise<ExternalFood | null> {
  barcodeImpl ??= defineCachedFunction(
    (s: ExternalSource, c: string) => s.byBarcode(c),
    {
      name: 'external-barcode',
      maxAge: MAX_AGE,
      swr: false,
      getKey: (s: ExternalSource, c: string) => `${s.key}:${c}`
    }
  )
  return barcodeImpl(source, code)
}
