<script setup lang="ts">
import type { TrackedNutrient } from '~/composables/useTrackedNutrients'
import { NUTRITION_MACROS } from '~/constants/nutrition'
import { formatAmount } from '~/utils/nutrition/macros'

const props = defineProps<{
  total: Record<string, number>
  perServing?: Record<string, number> | null
  servingName?: string
}>()

// Awaited (not useTrackedNutrients()) so the extras chip is present on first render, not a tick later.
const { data: tracked } = await useNutritionFetch<TrackedNutrient[]>(NUTRITION_KEYS.tracked, '/api/nutrition/nutrients/tracked')

const rows = computed(() => {
  const macroKeys = new Set<string>(NUTRITION_MACROS.map((m) => m.key))
  const extras = (tracked.value ?? []).filter((t) => !macroKeys.has(t.key))
  return [...NUTRITION_MACROS.map((m) => ({ key: m.key, name: m.name, unit: m.unit })), ...extras]
})

const barKeys = ['protein', 'carbohydrate', 'fat'] as const
const BAR_COLOR = { protein: 'protein', carbohydrate: 'carb', fat: 'fat' } as const
const extraRows = computed(() => rows.value.filter((r) => !(barKeys as readonly string[]).includes(r.key) && r.key !== 'energy'))
const detailRows = computed(() => rows.value.filter((r) => r.key !== 'energy'))

function row(key: string) {
  return rows.value.find((r) => r.key === key)!
}
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-3">
      <div class="flex items-baseline gap-1 flex-wrap">
        <span class="text-2xl font-bold tabular-nums text-highlighted" data-test="total-energy">{{ formatAmount('energy', total.energy) }}</span>
        <span class="text-dimmed text-sm">kcal total</span>
        <template v-if="props.perServing">
          <span class="text-dimmed">·</span>
          <span class="font-semibold tabular-nums" data-test="per-serving-energy">{{ formatAmount('energy', props.perServing.energy) }}</span>
          <span class="text-dimmed text-sm">per {{ servingName }}</span>
        </template>
      </div>

      <div class="flex flex-col gap-2">
        <NutritionMacroBar
          v-for="key in barKeys"
          :key="key"
          :label="row(key).name"
          :figure="`${formatAmount(key, props.perServing ? props.perServing[key] : total[key])} ${row(key).unit}`"
          :progress="null"
          :color="BAR_COLOR[key]"
          :data-test="`bar-${key}`"
        />
      </div>

      <div v-if="props.perServing" class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs text-dimmed">
        <template v-for="r in detailRows" :key="r.key">
          <span>{{ r.name }} per serving</span>
          <span class="text-right tabular-nums" :data-test="`per-serving-${r.key}`">{{ formatAmount(r.key, props.perServing[r.key]) }} {{ r.unit }}</span>
        </template>
      </div>

      <NutritionMacroText :nutrients="total" :extras="extraRows" test-prefix="total" />
    </div>
  </UCard>
</template>
