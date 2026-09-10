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

export interface BarcodeErrorEntry {
  source: ExternalFood['source']
  kind: 'unconfigured' | 'unavailable' | 'rate_limited' | 'not_found'
  message: string
}

export type BarcodeLookupResult =
  | { kind: 'local', foodId: number }
  | { kind: 'external', external: ExternalFood }
  | { kind: 'missing', errors: BarcodeErrorEntry[] }

export function useBarcodeLookup() {
  async function lookup(code: string): Promise<BarcodeLookupResult> {
    try {
      const result = await $fetch<{ found: string, foodId?: number, external?: ExternalFood }>(
        `/api/nutrition/foods/barcode/${code}`
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
