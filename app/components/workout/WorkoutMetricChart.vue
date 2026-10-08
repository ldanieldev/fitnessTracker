<script setup lang="ts">
import type { SeriesPoint } from '~~/shared/types/series'

const props = withDefaults(defineProps<{
  points: SeriesPoint[]
  trend: SeriesPoint[]
  goal: number | null
  from: string
  to: string
  unit: string
  precision: number
  label: string
  zeroBased?: boolean
  height?: number
  format?: (value: number) => string
}>(), { zeroBased: false, height: 200, format: undefined })

const show = (value: number) => (props.format ? props.format(value) : value.toFixed(props.precision))
const withUnit = (value: number) => (props.unit ? `${show(value)} ${props.unit}` : show(value))

const summary = computed(() => {
  const last = props.points[props.points.length - 1]
  if (!last) return `${props.label}: nothing logged between ${chartDayLabel(props.from)} and ${chartDayLabel(props.to)}`
  const latest = `${withUnit(last.value)} on ${chartDayLabel(last.date)}`
  return `${props.label}: ${props.points.length} sessions, latest ${latest}`
})
</script>

<template>
  <AppLineChart
    :points="points"
    :trend="trend"
    :goal="goal"
    :goal-label="goal === null ? '' : format ? withUnit(goal) : `${goal} ${unit}`"
    :format-tick="format"
    :from="from"
    :to="to"
    :gap-days="21"
    :summary="summary"
    empty-text="Nothing logged in this range"
    :zero-based="zeroBased"
    :height="height"
  >
    <template #tooltip="{ dot, when }">
      <div class="text-dimmed">{{ when }}</div>
      <div class="font-medium tabular-nums">{{ withUnit(dot.value) }}</div>
    </template>
  </AppLineChart>
</template>
