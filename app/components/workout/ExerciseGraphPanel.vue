<script setup lang="ts">
import { format } from 'date-fns'
import type { ChartRange, SeriesPoint } from '~~/shared/types/series'
import type { Exercise, GraphMetric } from '~~/shared/types/workout'
import { cardioMetricDisplay } from '~~/shared/utils/cardioUnits'
import { metricLabel, metricPrecision, metricUnit, metricsFor } from '~~/shared/utils/workoutMetrics'

const props = defineProps<{ exercise: Exercise }>()

const options = computed(() => (
  metricsFor(props.exercise.trackingType, props.exercise.loadStyle)
    .map((value) => ({ value, label: metricLabel(value, props.exercise.loadStyle) }))
))

const metric = ref<GraphMetric>(
  props.exercise.defaultGraph && options.value.some((o) => o.value === props.exercise.defaultGraph)
    ? props.exercise.defaultGraph
    : options.value[0]!.value
)
const reps = ref<number | null>(null)
watch(metric, (value) => {
  if (value === 'weight_at_reps' && reps.value === null) reps.value = 5
}, { immediate: true })

const range = useState<ChartRange>('workouts:range', () => 'mtd')
const { series, trend, fetch } = useExerciseSeries(() => props.exercise.id, metric, reps, range)
await fetch

const showTrend = ref(true)
const zeroBased = ref(false)

const cardio = computed(() => cardioMetricDisplay(metric.value))
const unit = computed(() => cardio.value?.unit ?? series.value?.unit ?? metricUnit(metric.value))

function shown(points: SeriesPoint[]): SeriesPoint[] {
  const display = cardio.value
  if (!display) return points
  // Rollups written before zero-distance sets were excluded hold a 0 m/s pace, which displays as an infinite min/mi.
  return points.map((point) => ({ ...point, value: display.toDisplay(point.value) })).filter((point) => Number.isFinite(point.value))
}

const points = computed(() => shown(series.value?.points ?? []))
const trendPoints = computed(() => shown(trend.value))
const goalValue = computed(() => {
  const target = series.value?.goal?.targetValue
  if (target == null) return null
  return cardio.value ? cardio.value.toDisplay(target) : target
})
const precision = computed(() => series.value?.precision ?? metricPrecision(metric.value))
const label = computed(() => metricLabel(metric.value, props.exercise.loadStyle))

function goalDate(date: string) {
  return format(new Date(`${date}T00:00:00`), 'd MMM')
}

const goalSummary = computed(() => {
  const goal = series.value?.goal
  if (!goal || goalValue.value === null) return null
  const amount = cardio.value ? cardio.value.format(goalValue.value) : String(goalValue.value)
  const target = unit.value ? `${amount} ${unit.value}` : amount
  return goal.targetDate ? `Goal ${target} by ${goalDate(goal.targetDate)}` : `Goal ${target}`
})

const goalSheetOpen = ref(false)
const fail = useFailToast()
const settingDefault = ref(false)

async function makeDefault() {
  settingDefault.value = true
  try {
    await apiFetch(`/api/workouts/exercises/${props.exercise.id}/prefs`, {
      method: 'PUT',
      body: { defaultGraph: metric.value }
    })
    await invalidateExercises(EXERCISE_KEYS.detail(props.exercise.id))
  } catch (error: unknown) {
    fail('Couldn\'t save default graph', error, 'Could not save this default')
  } finally {
    settingDefault.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <USelect v-model="metric" :items="options" class="min-w-0 flex-1" data-test="graph-metric" />
        <AppRangeTabs v-model="range" class="w-full sm:w-auto" />
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <!-- AppNumberInput's root is w-full, so the width has to sit on a wrapper or the unit gets pushed across the row -->
        <div v-if="metric === 'weight_at_reps'" class="w-36 shrink-0">
          <AppNumberInput v-model="reps" :min="1" :max="30" :step="1" data-test="graph-reps" />
        </div>
        <UCheckbox v-model="showTrend" label="Trend" data-test="graph-trend" />
        <UCheckbox v-model="zeroBased" label="Start at zero" data-test="graph-zero" />
      </div>
    </div>

    <WorkoutMetricChart
      v-if="series"
      :points="points"
      :trend="showTrend ? trendPoints : []"
      :goal="goalValue"
      :from="series.from"
      :to="series.to"
      :unit="unit"
      :precision="precision"
      :format="cardio?.format"
      :label="label"
      :zero-based="zeroBased"
    />

    <div class="flex flex-wrap items-center gap-2">
      <div v-if="goalSummary" class="flex items-center gap-1.5 text-sm text-dimmed" data-test="graph-goal-summary">
        <span>{{ goalSummary }}</span>
        <UBadge v-if="series?.goal?.achievedAt" label="Reached" color="success" variant="subtle" size="sm" />
      </div>
      <UButton
        :label="series?.goal ? 'Edit goal' : 'Set goal'"
        variant="soft"
        color="neutral"
        class="min-h-10"
        data-test="graph-goal"
        @click="goalSheetOpen = true"
      />
      <UButton
        v-if="metric !== exercise.defaultGraph"
        label="Make default"
        variant="ghost"
        color="neutral"
        class="ml-auto min-h-10"
        :loading="settingDefault"
        data-test="graph-make-default"
        @click="makeDefault"
      />
    </div>

    <WorkoutGoalSheet
      v-model:open="goalSheetOpen"
      :exercise-id="exercise.id"
      :metric="metric"
      :reps="reps"
      :unit="unit"
      :goal="series?.goal ?? null"
    />
  </div>
</template>
