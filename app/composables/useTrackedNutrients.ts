export interface TrackedNutrient {
  key: string
  name: string
  unit: string
  sortOrder: number
}

export const TRACKED_NUTRIENTS_KEY = 'nutrition:tracked'

export function useTrackedNutrients() {
  const { data: tracked, refresh } = useFetch<TrackedNutrient[]>('/api/nutrition/nutrients/tracked', {
    key: TRACKED_NUTRIENTS_KEY
  })
  return { tracked, refresh }
}
