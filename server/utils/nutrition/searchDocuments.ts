export interface SearchDocument {
  id: number
  name: string
  brand: string | null
  source: string
  barcode: string | null
  serving_labels: string[]
  is_catalog: boolean
  owner_id: number | null
}

interface FoodRowForIndex {
  id: number
  name: string
  brand: string | null
  barcode: string | null
  createdByUserId: number | null
}

export const SEARCH_INDEX = 'foods'

export const SEARCH_INDEX_SETTINGS = {
  searchableAttributes: ['name', 'brand', 'serving_labels', 'barcode'],
  filterableAttributes: ['is_catalog', 'owner_id', 'source'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']
}

export function foodToSearchDocument(food: FoodRowForIndex, servingLabels: string[], sourceKey: string): SearchDocument {
  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    source: sourceKey,
    barcode: food.barcode,
    serving_labels: servingLabels,
    is_catalog: food.createdByUserId === null,
    owner_id: food.createdByUserId
  }
}

export function visibilityFilter(userId: number): string {
  return `is_catalog = true OR owner_id = ${userId}`
}
