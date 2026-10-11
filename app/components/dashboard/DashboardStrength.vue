<script setup lang="ts">
import type { StrengthLift } from '~~/shared/types/dashboard'
import { formatDelta, formatValue } from '~~/shared/utils/bodyMetrics'
import { metricLabel, metricPrecision } from '~~/shared/utils/workoutMetrics'

const { data, error, refresh } = useDashboardStrength()

function improved(lift: StrengthLift) {
  if (lift.change === null || lift.change === 0) return null
  return lift.lowerIsBetter ? lift.change < 0 : lift.change > 0
}

function changeClass(lift: StrengthLift) {
  const up = improved(lift)
  return up === null ? 'text-dimmed' : up ? 'text-success' : 'text-error'
}

function goalLabel(lift: StrengthLift) {
  if (!lift.goal) return 'most trained'
  const reps = lift.goal.targetReps ? ` × ${lift.goal.targetReps}` : ''
  return `goal ${formatValue(lift.goal.targetValue, metricPrecision(lift.metric))}${reps}`
}

function trend(lift: StrengthLift) {
  if (lift.change !== null) return improved(lift)
  const first = lift.series[0]
  const last = lift.series.at(-1)
  if (first === undefined || last === undefined || first === last) return null
  return lift.lowerIsBetter ? last < first : last > first
}

function tone(lift: StrengthLift) {
  const up = trend(lift)
  return up === null ? 'neutral' : up ? 'success' : 'error'
}
</script>

<template>
  <DashboardCard
    v-if="data !== null"
    title="Strength"
    :aside="data ? 'last 12 wks' : undefined"
    data-test="dashboard-strength"
  >
    <DashboardRetry v-if="error && !data" label="Couldn’t load strength" @retry="refresh()" />
    <template v-else-if="data">
      <p v-if="!data.lifts.length" class="text-sm text-dimmed">Log a few workouts to see strength trends</p>
      <div
        v-for="lift in data.lifts"
        :key="`${lift.exerciseId}-${lift.metric}`"
        class="flex flex-col gap-1 border-t border-default pt-2 first:border-t-0 first:pt-0"
        data-test="strength-lift"
      >
        <div class="flex items-center justify-between gap-3">
          <span class="truncate text-sm text-highlighted">{{ lift.name }}</span>
          <DashboardSparkline :values="lift.series" :tone="tone(lift)" size="inline" />
        </div>
        <div class="flex items-baseline justify-between gap-2">
          <span>
            <span class="text-lg font-bold text-highlighted tabular-nums" data-test="lift-value">
              {{ formatValue(lift.value, metricPrecision(lift.metric)) }}
            </span>
            <span class="text-xs text-muted"> {{ lift.unit }} </span>
            <span v-if="lift.metric !== 'e1rm'" class="text-xs text-muted" data-test="lift-metric">{{
              metricLabel(lift.metric, lift.lowerIsBetter ? 'assisted' : null)
            }}</span>
            <span
              v-if="lift.change !== null"
              class="text-xs font-semibold"
              :class="changeClass(lift)"
              data-test="lift-change"
            >
              {{ formatDelta(lift.change, metricPrecision(lift.metric)) }}
            </span>
          </span>
          <span class="text-xs text-dimmed">{{ goalLabel(lift) }}</span>
        </div>
        <div
          v-if="lift.goal"
          class="h-1.5 overflow-hidden rounded-full bg-accented"
          role="progressbar"
          :aria-valuenow="Math.round(lift.goal.progress * 100)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`${lift.name} goal progress`"
        >
          <div
            class="h-full rounded-full bg-green-500"
            :style="{ width: `${Math.round(lift.goal.progress * 100)}%` }"
            data-test="lift-goal-bar"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <div
        v-for="row in 3"
        :key="row"
        class="flex flex-col gap-1 border-t border-default pt-2 first:border-t-0 first:pt-0"
        data-test="strength-skeleton"
      >
        <USkeleton class="h-5 w-2/3" />
        <USkeleton class="h-7 w-24" />
      </div>
    </template>
  </DashboardCard>
</template>
