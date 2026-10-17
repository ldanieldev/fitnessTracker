import type { UseFetchOptions } from 'nuxt/app'
import type { FetchContext, FetchResponse } from 'ofetch'
import { mountedAsyncDataKeys } from '~/utils/asyncData'

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

// useFetch binds $fetch from '#build/fetch' at module load, so apiFetch can't intercept it; 401s are handled here.
export function useNutritionFetch<T>(
  key: string | (() => string),
  url: string | (() => string),
  opts: UseFetchOptions<T> = {}
) {
  const existingHooks = opts.onResponseError
  const onExistingResponseError = Array.isArray(existingHooks) ? existingHooks : existingHooks ? [existingHooks] : []
  return useFetch<T>(url, {
    ...opts,
    key,
    onResponseError(context: FetchContext & { response: FetchResponse<unknown> }) {
      if (context.response.status === 401) handleUnauthorized()
      for (const hook of onExistingResponseError) (hook as (c: unknown) => unknown)(context)
    }
  } as Parameters<typeof useFetch<T>>[1]) // getCachedData's NoInfer<T> rejects UseFetchOptions<T> under a generic T
}

export async function invalidateNutrition(...keys: string[]) {
  const targets = mountedAsyncDataKeys(keys)
  if (targets.length) await refreshNuxtData(targets)
}
