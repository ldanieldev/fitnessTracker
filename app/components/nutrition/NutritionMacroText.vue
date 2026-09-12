<script setup lang="ts">
import { macroParts } from '~/utils/nutrition/macros'

const props = withDefaults(defineProps<{
  nutrients: Record<string, number | null | undefined>
  extras?: Array<{ key: string, name: string, unit: string }>
  withEnergy?: boolean
  size?: 'xs' | 'sm'
  testPrefix?: string
}>(), { extras: () => [], withEnergy: false, size: 'xs', testPrefix: 'macro' })

const parts = computed(() => macroParts(props.nutrients, { extras: props.extras, withEnergy: props.withEnergy }))
</script>

<template>
  <span class="inline-flex flex-wrap items-baseline gap-x-1 tabular-nums" :class="size === 'xs' ? 'text-xs' : 'text-sm'">
    <template v-for="(part, index) in parts" :key="part.key">
      <span v-if="index > 0" class="text-dimmed"> · </span>
      <span :class="part.cls" :data-test="`${testPrefix}-${part.key}`">{{ part.label }} {{ part.text }}</span>
    </template>
  </span>
</template>
