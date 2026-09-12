export interface TrackedNutrient {
  key: string
  name: string
  unit: string
  sortOrder: number
}

export function useTrackedNutrients() {
  const fetch = useNutritionFetch<TrackedNutrient[]>(NUTRITION_KEYS.tracked, '/api/nutrition/nutrients/tracked')
  const { data: tracked, refresh } = fetch
  return { tracked, refresh, fetch }
}
