<script setup lang="ts">
import { useId } from 'vue'
import type { SeriesPoint } from '~~/shared/types/series'
import { buildChartModel, nearestPoint, type ChartDot } from '~~/shared/utils/chartModel'

const props = withDefaults(
  defineProps<{
    points: SeriesPoint[]
    trend: SeriesPoint[]
    goal: number | null
    goalLabel?: string
    from: string
    to: string
    gapDays: number
    summary: string
    emptyText: string
    zeroBased?: boolean
    dense?: boolean
    height?: number
    formatTick?: (value: number) => string
  }>(),
  { goalLabel: '', zeroBased: false, dense: false, height: 200, formatTick: undefined }
)

defineSlots<{ tooltip(props: { dot: ChartDot; previous: ChartDot | null; when: string }): unknown }>()

const host = ref<HTMLElement | null>(null)
const width = useElementWidth(host)
const areaId = useId()

const model = computed(() =>
  buildChartModel({
    points: props.points,
    trend: props.trend,
    goal: props.goal,
    from: props.from,
    to: props.to,
    width: width.value,
    height: props.height,
    gapDays: props.gapDays,
    zeroBased: props.zeroBased
  })
)

const selectedIndex = ref(-1)
watch(
  () => props.points,
  () => (selectedIndex.value = -1)
)

const selected = computed(() => model.value.dots[selectedIndex.value] ?? null)
const previous = computed(() => model.value.dots[selectedIndex.value - 1] ?? null)

// The viewBox width equals the rendered width, so a pixel offset inside the plot rect is already in SVG units.
function pick(event: PointerEvent) {
  const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
  const dot = nearestPoint(model.value.dots, event.clientX - rect.left + model.value.plot.left)
  selectedIndex.value = dot ? model.value.dots.indexOf(dot) : -1
}

const tooltipLeft = computed(() =>
  selected.value ? Math.min(Math.max(selected.value.x - 48, 0), model.value.width - 112) : 0
)
</script>

<template>
  <div ref="host" class="relative w-full select-none" data-test="metric-chart">
    <svg
      :width="model.width"
      :height="model.height"
      :viewBox="`0 0 ${model.width} ${model.height}`"
      class="block w-full"
      role="img"
      :aria-label="summary"
    >
      <defs>
        <linearGradient :id="areaId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--ui-primary)" stop-opacity="0.25" />
          <stop offset="1" stop-color="var(--ui-primary)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g v-for="tick in model.yTicks" :key="tick.value">
        <line
          :x1="model.plot.left"
          :x2="model.plot.right"
          :y1="tick.y"
          :y2="tick.y"
          stroke="var(--ui-border)"
          stroke-width="1"
        />
        <text
          :x="model.plot.left - 6"
          :y="tick.y + 3"
          text-anchor="end"
          font-size="10"
          style="fill: var(--ui-text-dimmed)"
        >
          {{ formatTick ? formatTick(tick.value) : tick.value }}
        </text>
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
      <text
        v-if="model.goalEdge"
        :x="model.plot.right"
        :y="model.goalEdge === 'above' ? model.plot.top + 10 : model.plot.bottom - 4"
        text-anchor="end"
        font-size="10"
        style="fill: var(--ui-text-muted)"
        data-test="goal-edge"
      >
        {{ model.goalEdge === 'above' ? '↑' : '↓' }} Goal {{ goalLabel }}
      </text>
      <path v-if="model.areaPath" :d="model.areaPath" :fill="`url(#${areaId})`" />
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
      <path
        v-if="model.trendPath"
        :d="model.trendPath"
        fill="none"
        stroke="var(--ui-text-highlighted)"
        stroke-opacity="0.45"
        stroke-width="2"
        stroke-linejoin="round"
        data-test="trend-path"
      />
      <circle
        v-for="(dot, index) in dense ? [] : model.dots"
        :key="index"
        :cx="dot.x"
        :cy="dot.y"
        r="3"
        fill="var(--ui-primary)"
      />
      <text
        v-for="tick in model.xTicks"
        :key="tick.date"
        :x="tick.x"
        :y="model.height - 6"
        text-anchor="middle"
        font-size="10"
        style="fill: var(--ui-text-dimmed)"
      >
        {{ chartDayLabel(tick.date) }}
      </text>
      <g v-if="selected">
        <line
          :x1="selected.x"
          :x2="selected.x"
          :y1="model.plot.top"
          :y2="model.plot.bottom"
          stroke="var(--ui-text-muted)"
          stroke-width="1"
        />
        <circle
          :cx="selected.x"
          :cy="selected.y"
          r="4.5"
          fill="var(--ui-bg-elevated)"
          stroke="var(--ui-primary)"
          stroke-width="2"
        />
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
      <slot name="tooltip" :dot="selected" :previous="previous" :when="chartDayLabel(selected.date)" />
    </div>
    <p v-if="points.length === 0" class="absolute inset-0 flex items-center justify-center text-sm text-dimmed">
      {{ emptyText }}
    </p>
    <span class="sr-only">{{ summary }}</span>
  </div>
</template>
