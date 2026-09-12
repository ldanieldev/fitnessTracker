import type { CatalogNutrient } from '~/types/nutrition'

export function useNutrientCatalog() {
  const { data: catalog } = useNutritionFetch<CatalogNutrient[]>(NUTRITION_KEYS.catalog, '/api/nutrition/nutrients')
  const idToKey = computed(() => new Map((catalog.value ?? []).map((n) => [n.id, n.key])))
  return { catalog, idToKey }
}
