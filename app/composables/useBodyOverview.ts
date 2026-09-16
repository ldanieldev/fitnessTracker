import type { MetricOverview } from '~~/shared/types/body'

export function useBodyOverview() {
  const fetch = useBodyFetch<MetricOverview[]>(BODY_KEYS.overview, '/api/body/overview')
  const metrics = computed(() => fetch.data.value ?? [])
  return { metrics, fetch }
}
