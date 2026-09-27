<script setup lang="ts">
import { format } from 'date-fns'
import type { SeriesPoint } from '~~/shared/types/series'
import { buildChartModel, nearestPoint, type ChartDot } from '~~/shared/utils/chartModel'

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
}>(), { zeroBased: false, height: 200 })

const host = ref<HTMLElement | null>(null)
const width = useElementWidth(host)
const GAP_DAYS = 21

const model = computed(() => buildChartModel({
  points: props.points,
  trend: props.trend,
  goal: props.goal,
  from: props.from,
  to: props.to,
  width: width.value,
  height: props.height,
  gapDays: GAP_DAYS,
  zeroBased: props.zeroBased
}))

const selected = ref<ChartDot | null>(null)
watch(() => props.points, () => (selected.value = null))

function pick(event: PointerEvent) {
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  selected.value = nearestPoint(model.value.dots, event.clientX - rect.left + model.value.plot.left)
}

function day(date: string) {
  return format(new Date(`${date}T00:00:00`), 'MMM d')
}

const show = (value: number) => value.toFixed(props.precision)

const summary = computed(() => {
  const last = props.points[props.points.length - 1]
  if (!last) return `${props.label}: nothing logged between ${day(props.from)} and ${day(props.to)}`
  const latest = `${show(last.value)} ${props.unit} on ${day(last.date)}`
  return `${props.label}: ${props.points.length} sessions, latest ${latest}`
})

const tooltipLeft = computed(() => (
  selected.value ? Math.min(Math.max(selected.value.x - 48, 0), model.value.width - 112) : 0
))
</script>

<template>
  <div ref="host" class="relative w-full select-none" data-test="metric-chart">
    <svg :width="model.width" :height="model.height" :viewBox="`0 0 ${model.width} ${model.height}`" class="block w-full" role="img" :aria-label="summary">
      <defs>
        <linearGradient id="workout-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--ui-primary)" stop-opacity="0.25" />
          <stop offset="1" stop-color="var(--ui-primary)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g v-for="tick in model.yTicks" :key="tick.value">
        <line :x1="model.plot.left" :x2="model.plot.right" :y1="tick.y" :y2="tick.y" stroke="var(--ui-border)" stroke-width="1" />
        <text :x="model.plot.left - 6" :y="tick.y + 3" text-anchor="end" font-size="10" style="fill: var(--ui-text-dimmed)">{{ tick.value }}</text>
      </g>
      <line
        v-if="model.goalY !== null"
        :x1="model.plot.left"
        :x2="model.plot.right"
        :y1="model.goalY"
        :y2="model.goalY"
        stroke="var(--ui-text-muted)"
        stroke-width="1"
        stroke-dasharray="4 4"
        data-test="goal-line"
      />
      <path v-if="model.areaPath" :d="model.areaPath" fill="url(#workout-area)" />
      <path
        v-if="model.rawPath"
        :d="model.rawPath"
        fill="none"
        stroke="var(--ui-primary)"
        stroke-width="1.5"
        stroke-linejoin="round"
        data-test="raw-path"
      />
      <path v-if="model.trendPath" :d="model.trendPath" fill="none" stroke="var(--ui-text-highlighted)" stroke-opacity="0.45" stroke-width="2" stroke-linejoin="round" data-test="trend-path" />
      <circle v-for="(dot, index) in model.dots" :key="index" :cx="dot.x" :cy="dot.y" r="3" fill="var(--ui-primary)" />
      <text v-for="tick in model.xTicks" :key="tick.date" :x="tick.x" :y="model.height - 6" text-anchor="middle" font-size="10" style="fill: var(--ui-text-dimmed)">
        {{ day(tick.date) }}
      </text>
      <g v-if="selected">
        <line :x1="selected.x" :x2="selected.x" :y1="model.plot.top" :y2="model.plot.bottom" stroke="var(--ui-text-muted)" stroke-width="1" />
        <circle :cx="selected.x" :cy="selected.y" r="4.5" fill="var(--ui-bg-elevated)" stroke="var(--ui-primary)" stroke-width="2" />
      </g>
      <rect
        :x="model.plot.left"
        :y="model.plot.top"
        :width="Math.max(model.plot.right - model.plot.left, 0)"
        :height="Math.max(model.plot.bottom - model.plot.top, 0)"
        fill="transparent"
        class="touch-none"
        @pointerdown="pick"
        @pointermove="pick"
      />
    </svg>
    <div
      v-if="selected"
      class="pointer-events-none absolute top-1 rounded-md bg-elevated px-2 py-1 text-xs shadow ring ring-default"
      :style="{ left: `${tooltipLeft}px` }"
      data-test="chart-tooltip"
    >
      <div class="text-dimmed">{{ day(selected.date) }}</div>
      <div class="font-medium tabular-nums">{{ show(selected.value) }} {{ unit }}</div>
    </div>
    <p v-if="points.length === 0" class="absolute inset-0 flex items-center justify-center text-sm text-dimmed">Nothing logged in this range</p>
    <span class="sr-only">{{ summary }}</span>
  </div>
</template>
