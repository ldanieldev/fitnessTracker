<script setup lang="ts">
import type { SetMeasures, WorkoutEntry } from '~~/shared/types/workout'
import { lastTimeFor, prefillFor } from '~~/shared/utils/workoutPrefill'
import { formatSet } from '~~/shared/utils/setFormat'
import { measuresFor } from '~~/shared/utils/setRules'
import WorkoutSetRow from '~/components/workout/WorkoutSetRow.vue'

const props = defineProps<{
  entry: WorkoutEntry
  isFirst: boolean
  isLast: boolean
  saveErrors?: Record<string, string>
}>()

const emit = defineEmits<{
  addSet: [values: SetMeasures & { comment?: string }]
  editSet: [id: number, values: SetMeasures & { comment?: string }]
  removeSet: [id: number]
  toggleDone: [id: number]
  move: [direction: -1 | 1]
  remove: []
  retrySave: [setId: number | null]
}>()

function errorFor(setId: number | null) {
  return props.saveErrors?.[setId === null ? 'new' : String(setId)] ?? null
}

const prefill = computed(() => prefillFor(props.entry.sets, props.entry.lastSets))
const lastSummary = computed(() => {
  const measures = measuresFor(props.entry.trackingType)
  return props.entry.lastSets.map((set) => formatSet(measures, set))
})
const showBar = computed(() => props.entry.loadStyle === 'barbell' && props.entry.barWeight != null)
const nextLastSet = computed(() => lastTimeFor(props.entry.sets.length, props.entry.lastSets))
</script>

<template>
  <div class="flex flex-col gap-2 rounded-xl bg-elevated p-3">
    <div class="flex items-center gap-2">
      <div class="flex min-w-0 flex-1 flex-col">
        <NuxtLink
          :to="`/workouts/exercises/${entry.exerciseId}`"
          class="truncate font-medium leading-snug text-highlighted"
          :data-test="`entry-link-${entry.id}`"
        >
          {{ entry.exerciseName }}
        </NuxtLink>
      </div>
      <UButton
        icon="i-lucide-arrow-up"
        variant="ghost"
        color="neutral"
        class="min-h-10 min-w-10 justify-center"
        aria-label="Move up"
        :disabled="isFirst"
        :data-test="`entry-up-${entry.id}`"
        @click="emit('move', -1)"
      />
      <UButton
        icon="i-lucide-arrow-down"
        variant="ghost"
        color="neutral"
        class="min-h-10 min-w-10 justify-center"
        aria-label="Move down"
        :disabled="isLast"
        :data-test="`entry-down-${entry.id}`"
        @click="emit('move', 1)"
      />
      <UButton
        icon="i-lucide-trash-2"
        variant="ghost"
        color="error"
        class="min-h-10 min-w-10 justify-center"
        aria-label="Remove exercise"
        :data-test="`entry-remove-${entry.id}`"
        @click="emit('remove')"
      />
    </div>
    <div v-if="showBar || entry.lastSets.length > 0" class="-mt-4 flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-snug text-dimmed">
      <span v-if="showBar">Bar: {{ entry.barWeight }} lb</span>
      <span
        v-if="entry.lastSets.length > 0"
        class="flex flex-wrap gap-x-1 gap-y-0.5 sm:gap-x-4"
        :data-test="`entry-last-${entry.id}`"
      >
        <span>Last time:</span>
        <template v-for="(set, index) in lastSummary" :key="index">
          <span v-if="index > 0" class="sm:hidden">·</span>
          <span class="whitespace-nowrap" data-test="entry-last-set">{{ set }}</span>
        </template>
      </span>
    </div>

    <div v-for="(set, index) in entry.sets" :key="set.id" data-test="set-row">
      <WorkoutSetRow
        :set="set"
        :index="index"
        :tracking-type="entry.trackingType"
        :load-style="entry.loadStyle"
        :last-set="lastTimeFor(index, entry.lastSets)"
        :prefill="prefill"
        :weight-increment="entry.weightIncrement"
        @save="(values) => emit('editSet', set.id, values)"
        @remove="emit('removeSet', set.id)"
        @toggle-done="emit('toggleDone', set.id)"
      />
      <div v-if="errorFor(set.id)" class="flex items-center gap-2 pl-8 pt-1" :data-test="`set-save-error-${set.id}`">
        <span class="min-w-0 flex-1 truncate text-xs text-error">{{ errorFor(set.id) }}</span>
        <UButton
          label="Retry"
          variant="soft"
          color="error"
          class="min-h-10 shrink-0"
          :data-test="`set-retry-${set.id}`"
          @click="emit('retrySave', set.id)"
        />
      </div>
    </div>

    <div data-test="set-row">
      <WorkoutSetRow
        :index="entry.sets.length"
        :tracking-type="entry.trackingType"
        :load-style="entry.loadStyle"
        :last-set="nextLastSet"
        :prefill="prefill"
        :weight-increment="entry.weightIncrement"
        @save="(values) => emit('addSet', values)"
      />
      <div v-if="errorFor(null)" class="flex items-center gap-2 pl-8 pt-1" data-test="set-save-error-new">
        <span class="min-w-0 flex-1 truncate text-xs text-error">{{ errorFor(null) }}</span>
        <UButton
          label="Retry"
          variant="soft"
          color="error"
          class="min-h-10 shrink-0"
          data-test="set-retry-new"
          @click="emit('retrySave', null)"
        />
      </div>
    </div>
  </div>
</template>
