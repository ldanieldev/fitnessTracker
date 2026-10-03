<script setup lang="ts">
import { format } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkoutSessionSummary } from '~~/shared/types/workout'
import { durationLabel } from '~~/shared/utils/workoutTime'

const props = defineProps<{ summary: WorkoutSessionSummary, copyDisabled?: boolean }>()
const emit = defineEmits<{
  copy: [id: number]
  share: [id: number]
  times: [summary: WorkoutSessionSummary]
  delete: [summary: WorkoutSessionSummary]
}>()

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

const line = computed(() => {
  const s = props.summary
  const when = format(new Date(`${s.performedOn}T00:00:00`), 'EEE, MMM d')
  const parts = [when, plural(s.exerciseCount, 'exercise'), plural(s.setCount, 'set')]
  if (s.endedAt) parts.push(durationLabel(s.startedAt, new Date(s.endedAt).getTime()))
  return parts.join(' · ')
})

// Nuxt UI renders menu items through pickLinkProps, so a data-test on the item is dropped; the label slot carries it.
const menu = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Share',
      icon: 'i-lucide-share-2',
      testId: `session-share-${props.summary.id}`,
      onSelect: () => emit('share', props.summary.id)
    },
    {
      label: 'Change date & time',
      icon: 'i-lucide-calendar-clock',
      testId: `session-times-${props.summary.id}`,
      onSelect: () => emit('times', props.summary)
    }
  ],
  [{
    label: 'Delete',
    icon: 'i-lucide-trash-2',
    color: 'error',
    testId: `session-delete-${props.summary.id}`,
    onSelect: () => emit('delete', props.summary)
  }]
])
</script>

<template>
  <div class="flex items-center gap-1 rounded-xl bg-elevated px-2 py-1" data-test="session-row">
    <NuxtLink
      :to="`/workouts/sessions/${summary.id}`"
      class="flex min-h-10 min-w-0 flex-1 flex-col justify-center py-1"
      :data-test="`session-link-${summary.id}`"
    >
      <span class="truncate font-medium text-highlighted">{{ summary.name ?? 'Workout' }}</span>
      <span class="truncate text-xs text-dimmed">{{ line }}</span>
    </NuxtLink>
    <UButton
      icon="i-lucide-copy"
      variant="ghost"
      color="neutral"
      class="min-h-10 min-w-10 justify-center"
      aria-label="Copy into a new workout"
      :disabled="copyDisabled"
      :data-test="`session-copy-${summary.id}`"
      @click="emit('copy', summary.id)"
    />
    <UDropdownMenu :items="menu">
      <UButton
        icon="i-lucide-ellipsis-vertical"
        variant="ghost"
        color="neutral"
        class="min-h-10 min-w-10 justify-center"
        aria-label="Workout options"
        :data-test="`session-menu-${summary.id}`"
      />
      <template #item-label="{ item }">
        <span :data-test="item.testId">{{ item.label }}</span>
      </template>
    </UDropdownMenu>
  </div>
</template>
