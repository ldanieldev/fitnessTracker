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
  seriesRange: (typeId: number, range: BodyRange) => `body:series:${typeId}:${range}`,
  steps: 'body:steps:',
  stepWeeks: (count: number) => `body:steps:weeks:${count}`,
  stepTarget: 'body:steps:target'
} as const

// Delegates for the shared 401 hook; dedupe 'defer' shares one mount-time fetch (invalidateBody forces a fresh one).
export function useBodyFetch<T>(
  key: string | (() => string),
  url: string | (() => string),
  opts: UseFetchOptions<T> = {}
) {
  return useNutritionFetch<T>(key, url, { dedupe: 'defer', ...opts })
}

// Runs targets with dedupe 'cancel': useBodyFetch's 'defer' would return an invalidated key's stale in-flight promise.
export async function invalidateBody(...keys: string[]) {
  const exact = keys.filter((k) => !k.endsWith(':'))
  const prefixes = keys.filter((k) => k.endsWith(':'))
  const nuxtApp = useNuxtApp()
  const mounted = Object.keys(nuxtApp._asyncData ?? {})
  const targets = new Set(exact.filter((k) => mounted.includes(k)))
  for (const key of mounted) if (prefixes.some((p) => key.startsWith(p))) targets.add(key)
  await Promise.all([...targets].map((key) => nuxtApp._asyncData[key]?.execute({ dedupe: 'cancel' })))
}
