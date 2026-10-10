<script setup lang="ts">
import { format } from 'date-fns'
import type { StepWeek } from '~~/shared/types/steps'
import { formatSteps } from '~~/shared/utils/steps'

defineProps<{ weeks: StepWeek[] }>()

const day = (date: string) => format(new Date(`${date}T00:00:00`), 'MMM d')

function badge(week: StepWeek): { label: string; color: 'success' | 'error' | 'neutral' } | null {
  if (week.logged === 0) return { label: 'Not tracked', color: 'neutral' }
  if (week.met === null) return null
  return week.met ? { label: 'Met', color: 'success' } : { label: 'Missed', color: 'error' }
}
</script>

<template>
  <ul class="flex flex-col divide-y divide-default">
    <li
      v-for="week in weeks"
      :key="week.start"
      class="flex min-h-14 items-center gap-3 py-2"
      :data-test="`steps-history-${week.start}`"
    >
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="text-sm">{{ day(week.start) }} – {{ day(week.end) }}</span>
        <span class="text-xs tabular-nums text-dimmed">
          {{ formatSteps(week.average) }}/day · {{ formatSteps(week.total) }} total · {{ week.logged }}/7
        </span>
      </div>
      <UBadge
        v-if="badge(week)"
        :label="badge(week)!.label"
        :color="badge(week)!.color"
        variant="subtle"
        :data-test="`steps-badge-${week.start}`"
      />
    </li>
  </ul>
</template>
