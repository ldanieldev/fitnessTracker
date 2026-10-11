<script setup lang="ts">
import { pathFrom, scaleLinear } from '~~/shared/utils/chartModel'

const props = withDefaults(
  defineProps<{
    values: number[]
    goal?: number | null
    tone?: 'success' | 'error' | 'neutral'
    size?: 'fill' | 'inline'
  }>(),
  { goal: null, tone: 'neutral', size: 'fill' }
)

const W = 100
const H = 32
const SIZE = { fill: 'h-8 w-full', inline: 'h-5 w-16 shrink-0' }
const STROKE = { success: 'var(--ui-success)', error: 'var(--ui-error)', neutral: 'var(--ui-text-dimmed)' }

const y = computed(() => {
  const all = props.goal === null ? props.values : [...props.values, props.goal]
  const low = Math.min(...all)
  const high = Math.max(...all)
  return scaleLinear(low === high ? [low - 1, high + 1] : [low, high], [H - 2, 2])
})
const path = computed(() =>
  props.values.length < 2
    ? ''
    : pathFrom([props.values.map((v, i) => ({ x: (i / (props.values.length - 1)) * W, y: y.value(v) }))])
)
const goalY = computed(() => (props.goal === null ? null : y.value(props.goal)))
</script>

<template>
  <svg
    v-if="path"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    :class="SIZE[size]"
    aria-hidden="true"
    data-test="dashboard-sparkline"
  >
    <line
      v-if="goalY !== null"
      x1="0"
      :x2="W"
      :y1="goalY"
      :y2="goalY"
      stroke="var(--ui-success)"
      stroke-dasharray="3 3"
      vector-effect="non-scaling-stroke"
      data-test="sparkline-goal"
    />
    <path
      :d="path"
      fill="none"
      :stroke="STROKE[tone]"
      stroke-width="2"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
