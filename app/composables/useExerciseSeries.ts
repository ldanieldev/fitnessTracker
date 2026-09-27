import type { MaybeRefOrGetter } from 'vue'
import type { ChartRange } from '~~/shared/types/series'
import type { ExerciseSeries, GraphMetric } from '~~/shared/types/workout'
import { rangeStart } from '~~/shared/utils/series'
import { workoutTrend } from '~~/shared/utils/workoutMetrics'

export function useExerciseSeries(
  exerciseId: MaybeRefOrGetter<number>,
  metric: MaybeRefOrGetter<GraphMetric>,
  reps: MaybeRefOrGetter<number | null>,
  range: MaybeRefOrGetter<ChartRange>
) {
  const to = useTodayOrNow()
  const from = computed(() => rangeStart(toValue(range), to.value))
  const query = computed(() => ({
    metric: toValue(metric),
    ...(toValue(reps) != null ? { reps: toValue(reps) } : {}),
    ...(from.value ? { from: from.value } : {}),
    to: to.value
  }))

  const fetch = useWorkoutFetch<ExerciseSeries>(
    () => WORKOUT_KEYS.series(toValue(exerciseId), toValue(metric), toValue(reps), toValue(range)),
    () => `/api/workouts/exercises/${toValue(exerciseId)}/series`,
    { query }
  )

  const trend = computed(() => {
    const series = fetch.data.value
    return series ? workoutTrend(series.points, series.from, series.to) : []
  })

  return { series: fetch.data, trend, fetch }
}
