import type { UseFetchOptions } from 'nuxt/app'
import type { BodyRange } from '~~/shared/types/body'

export const BODY_KEYS = {
  types: 'body:types',
  typesAll: 'body:types:all',
  overview: 'body:overview',
  goals: 'body:goals',
  entries: (typeId: number) => `body:entries:${typeId}:`,
  entriesRange: (typeId: number, from: string | null, to: string) => `body:entries:${typeId}:${from ?? ''}:${to}`,
  series: (typeId: number) => `body:series:${typeId}:`,
  seriesRange: (typeId: number, range: BodyRange) => `body:series:${typeId}:${range}`
} as const

// Delegates so body reads share the nutrition helpers' 401 hook; dedupe: 'defer' shares one mount-time in-flight fetch across callers (invalidateBody below forces a fresh one regardless).
export function useBodyFetch<T>(key: string | (() => string), url: string | (() => string), opts: UseFetchOptions<T> = {}) {
  return useNutritionFetch<T>(key, url, { dedupe: 'defer', ...opts })
}

// Executes each target directly with dedupe: 'cancel' instead of delegating to invalidateNutrition/refreshNuxtData, whose default dedupe ('defer', from useBodyFetch) would just hand back a mutation-invalidated key's stale in-flight promise.
export async function invalidateBody(...keys: string[]) {
  const exact = keys.filter((k) => !k.endsWith(':'))
  const prefixes = keys.filter((k) => k.endsWith(':'))
  const nuxtApp = useNuxtApp()
  const mounted = Object.keys(nuxtApp._asyncData ?? {})
  const targets = new Set(exact.filter((k) => mounted.includes(k)))
  for (const key of mounted) if (prefixes.some((p) => key.startsWith(p))) targets.add(key)
  await Promise.all([...targets].map((key) => nuxtApp._asyncData[key]?.execute({ dedupe: 'cancel' })))
}
