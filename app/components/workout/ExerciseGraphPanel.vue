<script setup lang="ts">
import { format } from 'date-fns'
import type { ChartRange } from '~~/shared/types/series'
import type { Exercise, GraphMetric } from '~~/shared/types/workout'
import { metricLabel, metricPrecision, metricUnit, metricsFor } from '~~/shared/utils/workoutMetrics'
import { errorMessage } from '~/utils/apiError'

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

const unit = computed(() => series.value?.unit ?? metricUnit(metric.value))
const precision = computed(() => series.value?.precision ?? metricPrecision(metric.value))
const label = computed(() => metricLabel(metric.value, props.exercise.loadStyle))

function goalDate(date: string) {
  return format(new Date(`${date}T00:00:00`), 'd MMM')
}

const goalSummary = computed(() => {
  const goal = series.value?.goal
  if (!goal) return null
  const target = `${goal.targetValue} ${unit.value}`
  return goal.targetDate ? `Goal ${target} by ${goalDate(goal.targetDate)}` : `Goal ${target}`
})

const goalSheetOpen = ref(false)
const toast = useToast()
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
    toast.add({
      title: 'Could not save default',
      description: errorMessage(error, 'Could not save this default'),
      color: 'error'
    })
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
      :points="series.points"
      :trend="showTrend ? trend : []"
      :goal="series.goal?.targetValue ?? null"
      :from="series.from"
      :to="series.to"
      :unit="unit"
      :precision="precision"
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
