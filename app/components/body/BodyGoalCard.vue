<script setup lang="ts">
import { format } from 'date-fns'
import type { GoalOverview } from '~~/shared/types/body'
import { formatDelta, formatValue, goalProgress, requiredPace } from '~~/shared/utils/bodyMetrics'

const props = defineProps<{ item: GoalOverview, today: string }>()
const emit = defineEmits<{ edit: [] }>()

const latest = computed(() => props.item.latest?.value ?? null)
const progress = computed(() => goalProgress(props.item.goal, latest.value))
const pace = computed(() => requiredPace(props.item.goal, latest.value, props.today))

const remainingText = computed(() => {
  if (progress.value.reached) return 'Reached'
  if (progress.value.remaining === null) return 'No readings yet'
  return `${formatValue(Math.abs(progress.value.remaining), props.item.type.precision)} ${props.item.type.unit} to go`
})

const paceText = computed(() => {
  if (!props.item.goal.targetDate) return 'No target date'
  const by = format(new Date(`${props.item.goal.targetDate}T00:00:00`), 'MMM d, yyyy')
  if (pace.value === null) return `by ${by}`
  return `by ${by} · needs ${formatDelta(pace.value, props.item.type.precision)} ${props.item.type.unit}/wk`
})
</script>

<template>
  <UCard :data-test="`goal-card-${item.type.id}`">
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <NuxtLink :to="`/body/${item.type.id}`" class="flex-1 truncate font-medium">{{ item.type.name }}</NuxtLink>
        <UButton icon="i-lucide-pencil" variant="subtle" color="neutral" size="sm" :aria-label="`Edit ${item.type.name} goal`" :data-test="`goal-edit-${item.type.id}`" @click="emit('edit')" />
      </div>
      <div class="flex items-baseline justify-between text-sm tabular-nums">
        <span class="text-dimmed">{{ formatValue(item.goal.startValue, item.type.precision) }}</span>
        <span class="text-lg font-semibold text-highlighted">{{ formatValue(latest, item.type.precision) }} <span class="text-xs text-muted">{{ item.type.unit }}</span></span>
        <span class="text-dimmed">{{ formatValue(item.goal.targetValue, item.type.precision) }}</span>
      </div>
      <UProgress :model-value="(progress.percent ?? 0) * 100" :max="100" :color="progress.reached ? 'success' : 'primary'" size="sm" :data-test="`goal-progress-${item.type.id}`" />
      <div class="flex flex-wrap items-center justify-between gap-x-3 text-xs text-dimmed">
        <span :data-test="`goal-remaining-${item.type.id}`">{{ remainingText }}</span>
        <span :data-test="`goal-pace-${item.type.id}`">{{ paceText }}</span>
      </div>
    </div>
  </UCard>
</template>
