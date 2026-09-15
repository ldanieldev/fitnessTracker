<script setup lang="ts">
import { macroDonutSlices } from '~/utils/nutrition/donut'
import { formatAmount } from '~/utils/nutrition/macros'

const props = defineProps<{ nutrients: Record<string, number> }>()

const SIZE = 96
const STROKE = 14
const R = SIZE / 2 - STROKE
const C = 2 * Math.PI * R
const GAP = 3

const STROKE_CLASS: Record<string, string> = { protein: 'stroke-protein', carbohydrate: 'stroke-carb', fat: 'stroke-fat' }
const BG_CLASS: Record<string, string> = { protein: 'bg-protein', carbohydrate: 'bg-carb', fat: 'bg-fat' }

const slices = computed(() => macroDonutSlices(props.nutrients))
const sliceGramsTotal = computed(() => slices.value.reduce((sum, s) => sum + s.grams, 0))

const arcs = computed(() => {
  let cumulative = 0
  return slices.value.map((slice) => {
    const len = sliceGramsTotal.value > 0 ? (slice.grams / sliceGramsTotal.value) * C : 0
    const visible = Math.max(len - GAP, 0)
    const arc = { key: slice.key, strokeClass: STROKE_CLASS[slice.key], dasharray: `${visible} ${C - visible}`, dashoffset: -(cumulative + GAP / 2) }
    cumulative += len
    return arc
  })
})

const subtitle = 'by calories'

const summary = computed(() =>
  `Macro breakdown, ${subtitle}: ${slices.value.map((s) => `${s.label} ${formatAmount(s.key, s.grams)} g, ${s.percent}%`).join('; ')}.`
)
</script>

<template>
  <div v-if="slices.length" class="flex items-center gap-4">
    <svg :width="SIZE" :height="SIZE" :viewBox="`0 0 ${SIZE} ${SIZE}`" class="shrink-0" role="img" :aria-label="summary">
      <circle :cx="SIZE / 2" :cy="SIZE / 2" :r="R" style="stroke: var(--ui-bg-accented)" fill="none" :stroke-width="STROKE" />
      <circle
        v-for="arc in arcs"
        :key="arc.key"
        :cx="SIZE / 2"
        :cy="SIZE / 2"
        :r="R"
        :class="arc.strokeClass"
        fill="none"
        :stroke-width="STROKE"
        :stroke-dasharray="arc.dasharray"
        :stroke-dashoffset="arc.dashoffset"
        :transform="`rotate(-90 ${SIZE / 2} ${SIZE / 2})`"
      />
      <text :x="SIZE / 2" :y="SIZE / 2 - 2" text-anchor="middle" style="fill: var(--ui-text-dimmed)" font-size="9">{{ subtitle }}</text>
    </svg>
    <div class="flex flex-col gap-1 text-sm">
      <div v-for="slice in slices" :key="slice.key" class="flex items-center gap-2" :data-test="`donut-${slice.key}`">
        <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="BG_CLASS[slice.key]" />
        <span class="text-dimmed">{{ slice.label }}</span>
        <span class="font-medium tabular-nums" :class="slice.cls">{{ formatAmount(slice.key, slice.grams) }} g</span>
        <span class="text-dimmed tabular-nums">{{ slice.percent }}%</span>
      </div>
    </div>
    <span class="sr-only">{{ summary }}</span>
  </div>
</template>
