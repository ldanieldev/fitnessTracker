<script setup lang="ts">
import type { SeriesGranularity, SeriesPoint } from '~~/shared/types/series'
import { formatDelta, formatValue } from '~~/shared/utils/bodyMetrics'

const props = withDefaults(
  defineProps<{
    points: SeriesPoint[]
    trend: SeriesPoint[]
    goal: number | null
    from: string
    to: string
    precision: number
    unit: string
    granularity: SeriesGranularity
    height?: number
  }>(),
  { height: 200 }
)

const summary = computed(() => {
  const first = props.points[0]
  const last = props.points[props.points.length - 1]
  if (!first || !last) return 'No readings in this range'
  const latest = `${formatValue(last.value, props.precision)} ${props.unit}`
  const change = `${formatDelta(last.value - first.value, props.precision)} ${props.unit}`
  return `${chartDayLabel(props.from)} to ${chartDayLabel(props.to)}: latest ${latest}, change ${change}`
})
</script>

<template>
  <AppLineChart
    :points="points"
    :trend="trend"
    :goal="goal"
    :goal-label="goal === null ? '' : `${formatValue(goal, precision)} ${unit}`"
    :from="from"
    :to="to"
    :gap-days="granularity === 'week' ? 21 : 10"
    :summary="summary"
    empty-text="No readings in this range"
    :dense="points.length > 180"
    :height="height"
  >
    <template #tooltip="{ dot, previous, when }">
      <div class="text-dimmed">{{ when }}</div>
      <div class="font-medium tabular-nums">
        {{ formatValue(dot.value, precision) }} {{ unit }}
        <span v-if="previous" class="ml-1 text-dimmed">{{ formatDelta(dot.value - previous.value, precision) }}</span>
      </div>
    </template>
  </AppLineChart>
</template>
