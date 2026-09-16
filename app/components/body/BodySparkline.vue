<script setup lang="ts">
import type { SeriesPoint } from '~~/shared/types/body'
import { pathFrom, scaleLinear } from '~~/shared/utils/bodyChart'
import { dayIndex } from '~~/shared/utils/bodyMetrics'

const props = defineProps<{ points: SeriesPoint[] }>()

const W = 96
const H = 32

const path = computed(() => {
  if (props.points.length < 2) return ''
  const xs = props.points.map((p) => dayIndex(p.date))
  const ys = props.points.map((p) => p.value)
  const x = scaleLinear([Math.min(...xs), Math.max(...xs)], [2, W - 2])
  const y = scaleLinear([Math.min(...ys), Math.max(...ys)], [H - 2, 2])
  return pathFrom([props.points.map((p) => ({ x: x(dayIndex(p.date)), y: y(p.value) }))])
})
</script>

<template>
  <svg v-if="path" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`" class="shrink-0" aria-hidden="true" data-test="sparkline">
    <path :d="path" fill="none" stroke="var(--ui-primary)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  </svg>
</template>
