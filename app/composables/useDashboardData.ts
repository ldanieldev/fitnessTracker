import type { BodyweightTrend, Consistency, DashboardPart, NutritionStreak, Strength } from '~~/shared/types/dashboard'

// A hidden module answers 204, which useFetch sees as undefined; null keeps "hidden" apart from "not loaded yet".
function useDashboardPart<T>(part: DashboardPart) {
  const today = useTodayOrNow()
  return useNutritionFetch<T | null>(`dashboard:${part}`, `/api/dashboard/${part}`, {
    lazy: true,
    query: computed(() => ({ today: today.value })),
    transform: (value: T | null) => value ?? null
  })
}

export const useDashboardBodyweight = () => useDashboardPart<BodyweightTrend>('bodyweight')
export const useDashboardConsistency = () => useDashboardPart<Consistency>('consistency')
export const useDashboardStrength = () => useDashboardPart<Strength>('strength')
export const useDashboardNutrition = () => useDashboardPart<NutritionStreak>('nutrition')
