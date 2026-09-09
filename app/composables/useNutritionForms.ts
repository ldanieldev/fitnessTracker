import type { MaybeRefOrGetter } from 'vue'

export function numOrUndefined(value: string): number | undefined {
  if (value === '') return undefined
  const n = Number(value)
  return Number.isNaN(n) ? undefined : n
}

export function useContainerItems(containers: MaybeRefOrGetter<Array<{ id: number, name: string }>>) {
  return computed(() => toValue(containers).map((c) => ({ label: c.name, value: c.id })))
}
