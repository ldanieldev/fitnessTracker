import type { NutrientKey } from '~~/shared/types/nutrition'

export interface ExternalFood {
  source: 'off' | 'usda' | 'fatsecret'
  externalId: string
  name: string
  brand: string | null
  barcode: string | null
  per100g: Partial<Record<NutrientKey, number>> | null
  servingGrams: number | null
  servingLabel: string | null
  attribution: string | null
}

export const EXTERNAL_SOURCE_LABELS: Record<ExternalFood['source'], string> = {
  off: 'Open Food Facts',
  usda: 'USDA',
  fatsecret: 'FatSecret'
}

export interface BarcodeErrorEntry {
  source: ExternalFood['source']
  kind: 'unconfigured' | 'unavailable' | 'rate_limited' | 'not_found'
  message: string
}

export type BarcodeLookupResult =
  | { kind: 'local'; foodId: number }
  | { kind: 'external'; external: ExternalFood }
  | { kind: 'missing'; errors: BarcodeErrorEntry[] }

export function useBarcodeLookup() {
  async function lookup(code: string, opts: { externalOnly?: boolean } = {}): Promise<BarcodeLookupResult> {
    try {
      const result = await apiFetch<{ found: string; foodId?: number; external?: ExternalFood }>(
        `/api/nutrition/foods/barcode/${code}`,
        opts.externalOnly ? { query: { external: '1' } } : {}
      )
      if (result.found === 'local') return { kind: 'local', foodId: result.foodId! }
      return { kind: 'external', external: result.external! }
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err && (err as { statusCode?: number }).statusCode === 404) {
        const errors = (err as { data?: { data?: { errors?: BarcodeErrorEntry[] } } }).data?.data?.errors ?? []
        return { kind: 'missing', errors }
      }
      throw err
    }
  }

  return { lookup }
}
