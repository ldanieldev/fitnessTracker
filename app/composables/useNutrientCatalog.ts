import type { CatalogNutrient } from '~/types/nutrition'

export const NUTRIENT_CATALOG_KEY = 'nutrition:catalog'

export function useNutrientCatalog() {
  const { data: catalog } = useFetch<CatalogNutrient[]>('/api/nutrition/nutrients', { key: NUTRIENT_CATALOG_KEY })
  const idToKey = computed(() => new Map((catalog.value ?? []).map((n) => [n.id, n.key])))
  return { catalog, idToKey }
}
