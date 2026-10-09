<script setup lang="ts">
import { format } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkoutSessionSummary } from '~~/shared/types/workout'
import { durationLabel } from '~~/shared/utils/workoutTime'
import { plural } from '~/utils/plural'

const props = defineProps<{ summary: WorkoutSessionSummary; copyDisabled?: boolean }>()
const emit = defineEmits<{
  copy: [id: number]
  share: [id: number]
  times: [summary: WorkoutSessionSummary]
  delete: [summary: WorkoutSessionSummary]
}>()

const line = computed(() => {
  const s = props.summary
  const when = format(new Date(`${s.performedOn}T00:00:00`), 'EEE, MMM d')
  return [when, plural(s.exerciseCount, 'exercise'), plural(s.setCount, 'set')].join(' · ')
})

const duration = computed(() =>
  props.summary.endedAt ? durationLabel(props.summary.startedAt, new Date(props.summary.endedAt).getTime()) : null
)

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
  [
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error',
      testId: `session-delete-${props.summary.id}`,
      onSelect: () => emit('delete', props.summary)
    }
  ]
])
</script>

<template>
  <div class="flex items-center gap-1 rounded-xl bg-elevated px-2 py-1" data-test="session-row">
    <NuxtLink
      :to="`/workouts/sessions/${summary.id}`"
      class="flex min-h-10 min-w-0 flex-1 flex-col justify-center py-1"
      :data-test="`session-link-${summary.id}`"
    >
      <span class="flex min-w-0 items-center gap-2">
        <span class="truncate font-medium text-highlighted">{{ summary.name ?? 'Workout' }}</span>
        <UBadge
          v-if="summary.program"
          :label="`P${summary.program.phaseIndex + 1} · W${summary.program.week}`"
          size="sm"
          variant="subtle"
          color="neutral"
          class="shrink-0"
          :data-test="`session-program-${summary.id}`"
        />
      </span>
      <span class="flex min-w-0 text-xs text-dimmed">
        <span class="truncate">{{ line }}</span>
        <span v-if="duration" class="shrink-0 whitespace-pre" :data-test="`session-duration-${summary.id}`">{{
          ` · ${duration}`
        }}</span>
      </span>
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
