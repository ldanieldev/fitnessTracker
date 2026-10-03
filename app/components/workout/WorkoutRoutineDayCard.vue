<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { RoutineDay, RoutineEntry } from '~~/shared/types/routine'
import { moveWithGroups, supersetIndex, supersetLabel } from '~~/shared/utils/supersets'
import { elapsedLabel } from '~~/shared/utils/workoutTime'
import { targetSummary } from '~~/shared/utils/workoutTargets'

const props = defineProps<{ day: RoutineDay, isDue: boolean, canMoveUp: boolean, canMoveDown: boolean }>()
const emit = defineEmits<{
  edit: []
  makeNext: []
  move: [delta: -1 | 1]
  remove: []
  skip: []
  start: []
  addExercise: []
  editEntry: [entry: RoutineEntry]
  moveEntry: [entry: RoutineEntry, delta: -1 | 1]
  supersetEntry: [entry: RoutineEntry]
  ungroupEntry: [entry: RoutineEntry]
}>()

const items = computed(() => props.day.entries.map((entry) => ({ id: entry.id, supersetGroup: entry.supersetGroup })))

const dayMenu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Edit day', icon: 'i-lucide-pencil', testId: `routine-day-edit-${props.day.id}`, onSelect: () => emit('edit') },
  {
    label: 'Make next',
    icon: 'i-lucide-arrow-right-to-line',
    disabled: props.day.floating || props.isDue,
    testId: `routine-day-make-next-${props.day.id}`,
    onSelect: () => emit('makeNext')
  }
], [
  { label: 'Move up', icon: 'i-lucide-arrow-up', disabled: !props.canMoveUp, testId: `routine-day-up-${props.day.id}`, onSelect: () => emit('move', -1) },
  { label: 'Move down', icon: 'i-lucide-arrow-down', disabled: !props.canMoveDown, testId: `routine-day-down-${props.day.id}`, onSelect: () => emit('move', 1) }
], [
  { label: 'Delete day', icon: 'i-lucide-trash-2', color: 'error', testId: `routine-day-delete-${props.day.id}`, onSelect: () => emit('remove') }
]])

function entryMenu(entry: RoutineEntry): DropdownMenuItem[][] {
  return [[
    { label: 'Edit…', icon: 'i-lucide-pencil', testId: `routine-entry-edit-${entry.id}`, onSelect: () => emit('editEntry', entry) }
  ], [
    { label: 'Move up', icon: 'i-lucide-arrow-up', disabled: moveWithGroups(items.value, entry.id, -1) === items.value, testId: `routine-entry-up-${entry.id}`, onSelect: () => emit('moveEntry', entry, -1) },
    { label: 'Move down', icon: 'i-lucide-arrow-down', disabled: moveWithGroups(items.value, entry.id, 1) === items.value, testId: `routine-entry-down-${entry.id}`, onSelect: () => emit('moveEntry', entry, 1) }
  ], [
    { label: 'Superset with…', icon: 'i-lucide-link', disabled: props.day.entries.length < 2, testId: `routine-entry-superset-${entry.id}`, onSelect: () => emit('supersetEntry', entry) },
    ...(entry.supersetGroup !== null
      ? [{ label: 'Remove from superset', icon: 'i-lucide-unlink', testId: `routine-entry-ungroup-${entry.id}`, onSelect: () => emit('ungroupEntry', entry) }]
      : [])
  ]]
}

function prescription(entry: RoutineEntry) {
  return targetSummary(entry.trackingType, entry.target) || null
}

function meta(entry: RoutineEntry) {
  const parts: string[] = []
  if (entry.optional) parts.push('optional')
  if (entry.restSeconds !== null) parts.push(`${elapsedLabel(entry.restSeconds)} rest`)
  if (entry.notes) parts.push(entry.notes)
  return parts.join(' · ')
}
</script>

<template>
  <UCard :data-test="`routine-day-${day.id}`">
    <template #header>
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2">
            <span class="truncate font-semibold text-highlighted">{{ day.name }}</span>
            <UBadge v-if="isDue" label="next" color="primary" variant="subtle" size="sm" :data-test="`routine-day-next-${day.id}`" />
          </p>
          <p v-if="day.description" class="truncate text-xs text-dimmed">{{ day.description }}</p>
        </div>
        <UButton v-if="isDue" label="Skip" variant="ghost" color="neutral" size="sm" class="min-h-10" data-test="routine-skip" @click="emit('skip')" />
        <UButton label="Start" icon="i-lucide-play" size="sm" class="min-h-10" :data-test="`routine-day-start-${day.id}`" @click="emit('start')" />
        <UDropdownMenu :items="dayMenu">
          <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Day actions" :data-test="`routine-day-menu-${day.id}`" />
          <template #item-label="{ item }">
            <span :data-test="item.testId">{{ item.label }}</span>
          </template>
        </UDropdownMenu>
      </div>
    </template>

    <div class="flex flex-col gap-1">
      <div
        v-for="entry in day.entries"
        :key="entry.id"
        class="flex items-center gap-2 border-l-4 pl-2"
        :class="supersetBorder(supersetIndex(items, entry.id))"
        :data-test="`routine-entry-${entry.id}`"
      >
        <span v-if="supersetLabel(items, entry.id)" class="w-6 shrink-0 font-mono text-xs font-semibold text-dimmed" :data-test="`routine-entry-label-${entry.id}`">
          {{ supersetLabel(items, entry.id) }}
        </span>
        <button
          type="button"
          class="group flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-1.5 sm:gap-3 sm:px-2 py-1.5 text-left transition-colors hover:bg-elevated/60 focus-visible:outline-2 focus-visible:outline-primary active:bg-elevated"
          :data-test="`routine-entry-open-${entry.id}`"
          @click="emit('editEntry', entry)"
        >
          <span class="flex min-w-0 flex-1 flex-col justify-center">
            <span class="line-clamp-2 font-medium leading-snug sm:truncate" :class="entry.deleted ? 'text-dimmed line-through' : 'text-highlighted'">{{ entry.exerciseName }}</span>
            <span v-if="meta(entry)" class="truncate text-xs text-dimmed" :data-test="`routine-entry-meta-${entry.id}`">{{ meta(entry) }}</span>
          </span>
          <span
            class="min-w-20 shrink-0 rounded-md border px-2 py-1 sm:min-w-24 sm:px-2.5 text-center text-sm tabular-nums transition-colors group-hover:border-primary"
            :class="prescription(entry) ? 'border-default text-highlighted' : 'border-primary/50 text-primary'"
            :data-test="`routine-entry-target-${entry.id}`"
          >{{ prescription(entry) ?? 'Set targets' }}</span>
        </button>
        <UDropdownMenu :items="entryMenu(entry)">
          <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Exercise actions" :data-test="`routine-entry-menu-${entry.id}`" />
          <template #item-label="{ item }">
            <span :data-test="item.testId">{{ item.label }}</span>
          </template>
        </UDropdownMenu>
      </div>
      <button
        type="button"
        class="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm text-dimmed hover:bg-elevated"
        :data-test="`routine-day-add-exercise-${day.id}`"
        @click="emit('addExercise')"
      >
        <UIcon name="i-lucide-plus" class="size-4 shrink-0" />
        <span>Add exercise</span>
      </button>
    </div>
  </UCard>
</template>
