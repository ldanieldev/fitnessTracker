import type { FoodForResolve } from '~~/shared/types/nutrition'

export interface FoodDetail extends FoodForResolve {
  name: string
  brand: string | null
  barcode: string | null
  createdByUserId: number | null
  source: { key: string, name: string, attributionRequired: boolean, licenseNotice: string | null } | null
  defaultServingId: number | null
  energyDensity: number | null
}

export interface FoodHit {
  id: number
  name: string
  brand: string | null
  isFavorite: boolean
  logCount: number
  energyDensity: number | null
}

export interface PickedFood {
  foodId: number
  name: string
  brand: string | null
  quantity: number
  unitLabel: string
  food: FoodDetail
}

export interface CatalogNutrient {
  id: number
  key: string
  name: string
  unit: string
  isMacro: boolean
  defaultDirection: 'min' | 'max' | 'target'
}
