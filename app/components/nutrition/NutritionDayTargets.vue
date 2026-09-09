<script setup lang="ts">
import type { DiaryTargetRow } from '~/composables/useDiaryDay'
import { evaluateTarget } from '~~/shared/utils/nutritionTargets'

const props = defineProps<{
  targets: DiaryTargetRow[]
  totals: Record<string, number>
  mode: 'remaining' | 'consumed'
}>()

const STATE_COLOR = { met: 'success', under: 'neutral', over: 'error' } as const

const rows = computed(() =>
  props.targets.map((target) => {
    const consumed = props.totals[target.key] ?? 0

    if (target.amount === null || target.direction === null) {
      return { key: target.key, name: target.name, unit: target.unit, state: 'none' as const, color: null, value: consumed }
    }

    const evaluation = evaluateTarget({ consumed, target: target.amount, direction: target.direction })
    const value = props.mode === 'consumed' ? consumed : evaluation.remaining
    return { key: target.key, name: target.name, unit: target.unit, state: evaluation.state, color: STATE_COLOR[evaluation.state], value }
  })
)
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-2">
      <div v-for="row in rows" :key="row.key" class="flex items-center justify-between gap-2 text-sm">
        <span class="font-medium">{{ row.name }}</span>
        <span :data-test="`${row.key}-value`" class="text-dimmed">{{ row.value.toFixed(1) }} {{ row.unit }}</span>
        <UBadge v-if="row.color" :data-test="`${row.key}-state`" :color="row.color" variant="subtle">{{ row.state }}</UBadge>
        <span v-else :data-test="`${row.key}-state`" class="text-dimmed">{{ row.state }}</span>
      </div>
    </div>
  </UCard>
</template>
