<script setup lang="ts">
const props = withDefaults(defineProps<{ value: number, max: number | null, label: string, sub?: string, size?: number, color?: 'primary' | 'error' | 'protein' | 'carb' | 'fat' | 'neutral' }>(), { sub: '', size: 100, color: 'primary' })
const stroke = computed(() => props.size * 0.09)
const r = computed(() => props.size / 2 - stroke.value)
const c = computed(() => 2 * Math.PI * r.value)
const ratio = computed(() => (props.max && props.max > 0 ? Math.min(props.value / props.max, 1) : 0))
const STROKE: Record<string, string> = { primary: 'stroke-primary', error: 'stroke-error', protein: 'stroke-protein', carb: 'stroke-carb', fat: 'stroke-fat' }
</script>

<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="shrink-0" role="img" :aria-label="`${label} ${sub}`">
    <circle v-if="max !== null" :cx="size / 2" :cy="size / 2" :r="r" style="stroke: var(--ui-bg-accented)" fill="none" :stroke-width="stroke" />
    <circle
      v-if="max"
      :cx="size / 2"
      :cy="size / 2"
      :r="r"
      :class="STROKE[color]"
      :style="color === 'neutral' ? 'stroke: var(--ui-text-dimmed)' : undefined"
      fill="none"
      :stroke-width="stroke"
      stroke-linecap="round"
      :stroke-dasharray="c"
      :stroke-dashoffset="c * (1 - ratio)"
      :transform="`rotate(-90 ${size / 2} ${size / 2})`"
    />
    <text :x="size / 2" :y="size / 2 - 2" text-anchor="middle" style="fill: var(--ui-text-highlighted)" class="font-bold tabular-nums" :font-size="size * 0.21" data-test="ring-value">{{ label }}</text>
    <text :x="size / 2" :y="size / 2 + size * 0.13" text-anchor="middle" style="fill: var(--ui-text-dimmed)" :font-size="size * 0.09">{{ sub }}</text>
  </svg>
</template>
