import type { MetricOverview } from '~~/shared/types/body'

export function useBodyOverview() {
  const today = useTodayOrNow()
  const fetch = useBodyFetch<MetricOverview[]>(BODY_KEYS.overview, '/api/body/overview', {
    query: computed(() => ({ today: today.value }))
  })
  const metrics = computed(() => fetch.data.value ?? [])
  return { metrics, fetch }
}
