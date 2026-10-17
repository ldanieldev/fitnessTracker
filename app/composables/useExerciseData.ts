import type { UseFetchOptions } from 'nuxt/app'
import { executeAsyncData } from '~/utils/asyncData'
import { EXERCISE_KEYS, exerciseListKey } from '~~/shared/utils/exerciseKeys'

export { EXERCISE_KEYS, exerciseListKey }

// Delegates so exercise reads share the nutrition helpers' 401 hook; dedupe 'defer' shares one mount-time fetch.
export function useExerciseFetch<T>(
  key: string | (() => string),
  url: string | (() => string),
  opts: UseFetchOptions<T> = {}
) {
  return useNutritionFetch<T>(key, url, { dedupe: 'defer', ...opts })
}

export function invalidateExercises(...keys: string[]) {
  return executeAsyncData(keys.length ? keys : ['workouts:'])
}
