import type { MaybeRefOrGetter } from 'vue'
import type { BodyRange, MetricSeries } from '~~/shared/types/body'
import { buildTrend, rangeStart } from '~~/shared/utils/bodyMetrics'

export function useBodySeries(typeId: MaybeRefOrGetter<number>, range: MaybeRefOrGetter<BodyRange>) {
  const to = useTodayOrNow()
  const from = computed(() => rangeStart(toValue(range), to.value))
  const query = computed(() => (from.value ? { from: from.value, to: to.value } : { to: to.value }))

  const fetch = useBodyFetch<MetricSeries>(
    () => BODY_KEYS.seriesRange(toValue(typeId), toValue(range)),
    () => `/api/body/types/${toValue(typeId)}/series`,
    { query }
  )

  const trend = computed(() => {
    const s = fetch.data.value
    return s ? buildTrend(s.points, s.granularity, s.from, s.to) : []
  })

  return { series: fetch.data, trend, from, to, fetch }
}
