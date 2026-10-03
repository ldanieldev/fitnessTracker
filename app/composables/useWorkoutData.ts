import type { UseFetchOptions } from 'nuxt/app'
import { WORKOUT_KEYS, sessionListKey, sessionMonthKey } from '~~/shared/utils/workoutKeys'

export { WORKOUT_KEYS, sessionListKey, sessionMonthKey }

// Delegates so workout reads share the nutrition helpers' 401 hook; dedupe 'defer' shares one mount-time fetch.
export function useWorkoutFetch<T>(
  key: string | (() => string),
  url: string | (() => string),
  opts: UseFetchOptions<T> = {}
) {
  return useNutritionFetch<T>(key, url, { dedupe: 'defer', ...opts })
}

// dedupe 'cancel' avoids the stale in-flight promise refreshNuxtData reuses; no keys clears the workouts: prefix.
export async function invalidateWorkouts(...keys: string[]) {
  const targets = keys.length ? keys : ['workouts:']
  const exact = targets.filter((k) => !k.endsWith(':'))
  const prefixes = targets.filter((k) => k.endsWith(':'))
  const nuxtApp = useNuxtApp()
  const mounted = Object.keys(nuxtApp._asyncData ?? {})
  const matched = new Set(exact.filter((k) => mounted.includes(k)))
  for (const key of mounted) if (prefixes.some((p) => key.startsWith(p))) matched.add(key)
  await Promise.all([...matched].map((key) => nuxtApp._asyncData[key]?.execute({ dedupe: 'cancel' })))
}
