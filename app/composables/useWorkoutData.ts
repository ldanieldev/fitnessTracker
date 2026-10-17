import type { UseFetchOptions } from 'nuxt/app'
import { executeAsyncData } from '~/utils/asyncData'
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

export function invalidateWorkouts(...keys: string[]) {
  return executeAsyncData(keys.length ? keys : ['workouts:'])
}
