import type { NutrientKey } from '~~/shared/types/nutrition'

export type ExternalSourceKey = 'off' | 'usda' | 'fatsecret'

export interface ExternalFood {
  source: ExternalSourceKey
  externalId: string
  name: string
  brand: string | null
  barcode: string | null
  per100g: Partial<Record<NutrientKey, number>> | null
  servingGrams: number | null
  servingLabel: string | null
  attribution: string | null
}

export class ExternalSourceError extends Error {
  constructor(
    public readonly source: ExternalSourceKey,
    public readonly kind: 'unconfigured' | 'unavailable' | 'rate_limited' | 'not_found',
    message: string
  ) {
    super(message)
    this.name = 'ExternalSourceError'
  }
}
