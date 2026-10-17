import type { UseFetchOptions } from 'nuxt/app'
import { executeAsyncData } from '~/utils/asyncData'
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

export function invalidateBody(...keys: string[]) {
  return executeAsyncData(keys)
}
