<script setup lang="ts">
import { NUTRITION_MACROS } from '~/constants/nutrition'

const props = defineProps<{
  total: Record<string, number>
  perServing?: Record<string, number> | null
  servingName?: string
}>()

const { tracked } = useTrackedNutrients()

const rows = computed(() => {
  const macroKeys = new Set<string>(NUTRITION_MACROS.map((m) => m.key))
  const extras = (tracked.value ?? []).filter((t) => !macroKeys.has(t.key))
  return [...NUTRITION_MACROS.map((m) => ({ key: m.key, name: m.name, unit: m.unit })), ...extras]
})

function format(key: string, value: number | undefined) {
  if (value === undefined) return '—'
  return key === 'energy' ? value.toFixed(0) : value.toFixed(1)
}
</script>

<template>
  <UCard>
    <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
      <span />
      <span class="text-dimmed text-xs text-right">Total</span>
      <span v-if="props.perServing" class="text-dimmed text-xs text-right">Per {{ servingName }}</span>
      <span v-else />
      <template v-for="row in rows" :key="row.key">
        <span>{{ row.name }}</span>
        <span class="text-right" :data-test="`total-${row.key}`">{{ format(row.key, total[row.key]) }} {{ row.unit }}</span>
        <span v-if="props.perServing" class="text-right" :data-test="`per-serving-${row.key}`">
          {{ format(row.key, props.perServing[row.key]) }} {{ row.unit }}
        </span>
        <span v-else />
      </template>
    </div>
  </UCard>
</template>
