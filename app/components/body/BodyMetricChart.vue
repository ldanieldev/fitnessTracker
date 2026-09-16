<script setup lang="ts">
import { format } from 'date-fns'
import type { SeriesGranularity, SeriesPoint } from '~~/shared/types/body'
import { buildChartModel, nearestPoint, type ChartDot } from '~~/shared/utils/bodyChart'
import { formatDelta, formatValue } from '~~/shared/utils/bodyMetrics'

const props = withDefaults(defineProps<{
  points: SeriesPoint[]
  trend: SeriesPoint[]
  goal: number | null
  from: string
  to: string
  precision: number
  unit: string
  granularity: SeriesGranularity
  height?: number
}>(), { height: 200 })

const host = ref<HTMLElement | null>(null)
const width = useElementWidth(host)
const dense = computed(() => props.points.length > 180)
const gapDays = computed(() => (props.granularity === 'week' ? 21 : 10))

const model = computed(() =>
  buildChartModel({
    points: props.points,
    trend: props.trend,
    goal: props.goal,
    from: props.from,
    to: props.to,
    width: width.value,
    height: props.height,
    gapDays: gapDays.value
  })
)

const selected = ref<ChartDot | null>(null)
watch(() => props.points, () => (selected.value = null))

const selectedDelta = computed(() => {
  const i = selected.value ? model.value.dots.indexOf(selected.value) : -1
  return i > 0 ? model.value.dots[i]!.value - model.value.dots[i - 1]!.value : null
})

// The viewBox width equals the rendered width, so a pixel offset inside the plot rect is already in SVG units.
function pick(event: PointerEvent) {
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  selected.value = nearestPoint(model.value.dots, event.clientX - rect.left + model.value.plot.left)
}

function label(date: string) {
  return format(new Date(`${date}T00:00:00`), 'MMM d')
}

const summary = computed(() => {
  const first = props.points[0]
  const last = props.points[props.points.length - 1]
  if (!first || !last) return 'No readings in this range'
  return `${label(props.from)} to ${label(props.to)}: latest ${formatValue(last.value, props.precision)} ${props.unit}, change ${formatDelta(last.value - first.value, props.precision)} ${props.unit}`
})

const tooltipLeft = computed(() => (selected.value ? Math.min(Math.max(selected.value.x - 48, 0), model.value.width - 112) : 0))
</script>

<template>
  <div ref="host" class="relative w-full select-none" data-test="metric-chart">
    <svg :width="model.width" :height="model.height" :viewBox="`0 0 ${model.width} ${model.height}`" class="block w-full" role="img" :aria-label="summary">
      <defs>
        <linearGradient id="body-area" x1="0" y1="0" x2="0" y2="1">
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
      <path v-if="model.areaPath" :d="model.areaPath" fill="url(#body-area)" />
      <path
        v-if="model.rawPath"
        :d="model.rawPath"
        fill="none"
        stroke="var(--ui-primary)"
        :stroke-opacity="dense ? 0.35 : 1"
        :stroke-width="dense ? 1 : 1.5"
        stroke-linejoin="round"
        data-test="raw-path"
      />
      <path v-if="model.trendPath" :d="model.trendPath" fill="none" stroke="var(--ui-text-highlighted)" stroke-opacity="0.45" stroke-width="2" stroke-linejoin="round" data-test="trend-path" />
      <circle v-for="dot in dense ? [] : model.dots" :key="dot.date" :cx="dot.x" :cy="dot.y" r="3" fill="var(--ui-primary)" />
      <text v-for="tick in model.xTicks" :key="tick.date" :x="tick.x" :y="model.height - 6" text-anchor="middle" font-size="10" style="fill: var(--ui-text-dimmed)">
        {{ label(tick.date) }}
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
      <div class="text-dimmed">{{ label(selected.date) }}</div>
      <div class="font-medium tabular-nums">
        {{ formatValue(selected.value, precision) }} {{ unit }}
        <span v-if="selectedDelta !== null" class="ml-1 text-dimmed">{{ formatDelta(selectedDelta, precision) }}</span>
      </div>
    </div>
    <p v-if="points.length === 0" class="absolute inset-0 flex items-center justify-center text-sm text-dimmed">No readings in this range</p>
    <span class="sr-only">{{ summary }}</span>
  </div>
</template>
