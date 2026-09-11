<script setup lang="ts">
import type { DiaryTargetRow } from '~/composables/useDiaryDay'
import { evaluateTarget } from '~~/shared/utils/nutritionTargets'

const props = defineProps<{
  targets: DiaryTargetRow[]
  totals: Record<string, number>
  goalName: string | null
}>()

const mode = defineModel<'remaining' | 'consumed'>('mode')

const STATE_COLOR = { met: 'success', under: 'neutral', over: 'error' } as const

const modeItems = [
  { label: 'Remaining', value: 'remaining' as const },
  { label: 'Consumed', value: 'consumed' as const }
]

const rows = computed(() =>
  props.targets.map((target) => {
    const consumed = props.totals[target.key] ?? 0

    if (target.amount === null || target.direction === null) {
      return {
        key: target.key,
        name: target.name,
        unit: target.unit,
        state: 'none' as const,
        color: null,
        value: consumed,
        consumed,
        progress: null as number | null
      }
    }

    const evaluation = evaluateTarget({ consumed, target: target.amount, direction: target.direction })
    const value = mode.value === 'consumed' ? consumed : evaluation.remaining
    return {
      key: target.key,
      name: target.name,
      unit: target.unit,
      state: evaluation.state,
      color: STATE_COLOR[evaluation.state],
      value,
      consumed,
      progress: evaluation.progress * 100
    }
  })
)
</script>

<template>
  <UCard>
    <div class="flex items-center justify-between gap-2 mb-2">
      <span class="text-sm text-dimmed">{{ goalName ?? 'No goal' }}</span>
      <UTabs v-model="mode" :items="modeItems" size="xs" :content="false" />
    </div>
    <div class="flex flex-col gap-3">
      <div v-for="row in rows" :key="row.key" class="flex flex-col gap-1 text-sm">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium">{{ row.name }}</span>
          <span :data-test="`${row.key}-value`" class="text-dimmed">{{ row.value.toFixed(1) }} {{ row.unit }}</span>
          <UBadge v-if="row.color" :data-test="`${row.key}-state`" :color="row.color" variant="subtle">{{ row.state }}</UBadge>
          <span v-else :data-test="`${row.key}-state`" class="text-dimmed">{{ row.state }}</span>
        </div>
        <div class="flex items-center gap-2">
          <UProgress v-if="row.progress !== null" :model-value="row.progress" :color="row.color ?? 'neutral'" size="xs" class="flex-1" />
          <span :data-test="`total-${row.key}`" class="text-dimmed text-xs">{{ row.consumed.toFixed(1) }} {{ row.unit }}</span>
        </div>
      </div>
    </div>
  </UCard>
</template>
