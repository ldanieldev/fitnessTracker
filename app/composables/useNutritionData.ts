import type { UseFetchOptions } from 'nuxt/app'

export const NUTRITION_KEYS = {
  containers: 'nutrition:containers',
  containersAll: 'nutrition:containers:all',
  recipes: 'nutrition:recipes',
  savedMeals: 'nutrition:saved-meals',
  foods: 'nutrition:foods',
  profiles: 'nutrition:profiles',
  tracked: 'nutrition:tracked',
  catalog: 'nutrition:catalog',
  day: (date: string) => `nutrition:day:${date}`,
  logged: (from: string) => `nutrition:logged:${from}`,
  summary: (from: string, to: string, window: number) => `nutrition:summary:${from}:${to}:${window}`
} as const

export const NUTRITION_LIST_KEYS = [
  NUTRITION_KEYS.containers,
  NUTRITION_KEYS.containersAll,
  NUTRITION_KEYS.recipes,
  NUTRITION_KEYS.savedMeals,
  NUTRITION_KEYS.foods,
  NUTRITION_KEYS.profiles,
  NUTRITION_KEYS.tracked
]

// `getCachedData`'s NoInfer<T> makes the real UseFetchOptions<T> type reject itself under a generic (unresolved) T — widen at the call boundary only.
export function useNutritionFetch<T>(key: string | (() => string), url: string | (() => string), opts: UseFetchOptions<T> = {}) {
  return useFetch<T>(url, { ...opts, key } as Parameters<typeof useFetch<T>>[1])
}

// A key ending in ':' is a prefix matching every mounted fetch under it (logged weeks, days).
export async function invalidateNutrition(...keys: string[]) {
  const exact = keys.filter((k) => !k.endsWith(':'))
  const prefixes = keys.filter((k) => k.endsWith(':'))
  const nuxtApp = useNuxtApp()
  const mounted = Object.keys(nuxtApp._asyncData ?? {})
  const targets = new Set(exact.filter((k) => mounted.includes(k)))
  for (const key of mounted) if (prefixes.some((p) => key.startsWith(p))) targets.add(key)
  if (targets.size) await refreshNuxtData([...targets])
}
