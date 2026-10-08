<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { SetMeasures, WorkoutEntry } from '~~/shared/types/workout'
import { targetProgressLabel } from '~~/shared/utils/workoutTargets'
import { prefillFor } from '~~/shared/utils/workoutPrefill'
import { progressionCopy, progressionFor } from '~~/shared/utils/workoutProgression'
import { formatSet } from '~~/shared/utils/setFormat'
import { measuresFor } from '~~/shared/utils/setRules'
import { plural } from '~/utils/plural'
import WorkoutSetRow from '~/components/workout/WorkoutSetRow.vue'
import WorkoutSetForm from '~/components/workout/WorkoutSetForm.vue'
import WorkoutProgressionPrompt from '~/components/workout/WorkoutProgressionPrompt.vue'

const props = withDefaults(defineProps<{
  entry: WorkoutEntry
  isFirst: boolean
  isLast: boolean
  plateButton?: boolean
  presetWeight?: { weight: number, seq: number } | null
  deload?: boolean
  saveErrors?: Record<string, string>
  supersetLabel?: string | null
  supersetBorderClass?: string | null
  canGroup?: boolean
}>(), {
  presetWeight: null,
  deload: false,
  supersetLabel: null,
  supersetBorderClass: null,
  canGroup: false
})

const emit = defineEmits<{
  addSet: [values: SetMeasures & { comment?: string }]
  editSet: [id: number, values: SetMeasures & { comment?: string }]
  removeSet: [id: number]
  move: [direction: -1 | 1]
  remove: []
  retrySave: [setId: number | null]
  plates: [weight: number | null]
  superset: []
  ungroup: []
}>()

const collapsed = defineModel<boolean>('collapsed', { default: false })
const confirmRemoveOpen = ref(false)

function errorFor(setId: number | null) {
  return props.saveErrors?.[setId === null ? 'new' : String(setId)] ?? null
}

const targetLabel = computed(() => targetProgressLabel(props.entry.trackingType, props.entry.target, props.entry.sets.length))
const targetMet = computed(() => props.entry.target?.sets != null && props.entry.sets.length >= props.entry.target.sets)
const measures = computed(() => measuresFor(props.entry.trackingType))
const prefill = computed(() => prefillFor(props.entry.sets, props.entry.lastSets))
const progression = computed(() => progressionFor(props.entry, props.deload))
const copy = computed(() =>
  progression.value ? progressionCopy(progression.value, props.entry.loadStyle, props.entry.target) : null)
const choice = ref<'apply' | 'stay' | null>(null)
const promptOpen = ref(false)
const formWeight = ref<number | null>(null)
const plateWeight = computed(() => formWeight.value ?? prefill.value.weight ?? null)

watch(
  [() => props.entry.sets.length, () => progression.value?.kind, () => progression.value?.weight],
  ([length], [previous]) => {
    choice.value = null
    promptOpen.value = progression.value !== null && length > previous
  }
)

function choose(picked: 'apply' | 'stay') {
  choice.value = picked
  promptOpen.value = false
}
const lastSummary = computed(() => props.entry.lastSets.map((set) => formatSet(measures.value, set)))
const showBar = computed(() => props.entry.loadStyle === 'barbell' && props.entry.barWeight != null)
const totalVolume = computed(() => {
  if (!measures.value.includes('weight') || !measures.value.includes('reps') || props.entry.sets.length === 0) return null
  return props.entry.sets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0).toLocaleString()
})

const menu = computed<DropdownMenuItem[][]>(() => [
  [{
    label: 'History',
    icon: 'i-lucide-history',
    to: `/workouts/exercises/${props.entry.exerciseId}?tab=history`,
    class: 'sm:hidden',
    testId: `entry-history-menu-${props.entry.id}`
  }],
  [
    { label: 'Move up', icon: 'i-lucide-arrow-up', disabled: props.isFirst, testId: `entry-up-${props.entry.id}`, onSelect: () => emit('move', -1) },
    { label: 'Move down', icon: 'i-lucide-arrow-down', disabled: props.isLast, testId: `entry-down-${props.entry.id}`, onSelect: () => emit('move', 1) }
  ],
  [
    { label: 'Superset with…', icon: 'i-lucide-link', disabled: !props.canGroup, testId: `entry-superset-add-${props.entry.id}`, onSelect: () => emit('superset') },
    ...(props.entry.supersetGroup !== null
      ? [{ label: 'Remove from superset', icon: 'i-lucide-unlink', testId: `entry-superset-remove-${props.entry.id}`, onSelect: () => emit('ungroup') }]
      : [])
  ],
  [{ label: 'Remove', icon: 'i-lucide-trash-2', color: 'error', testId: `entry-remove-${props.entry.id}`, onSelect: () => (confirmRemoveOpen.value = true) }]
])

function confirmRemove() {
  confirmRemoveOpen.value = false
  emit('remove')
}
</script>

<template>
  <UCard
    :ui="collapsed ? { root: 'divide-y-0', body: 'hidden' } : undefined"
    :class="supersetBorderClass ? ['border-l-4', supersetBorderClass] : undefined"
    :data-test="`entry-card-${entry.id}`"
  >
    <template #header>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <UButton
            :icon="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            variant="ghost"
            color="neutral"
            class="size-10 shrink-0 justify-center"
            :aria-label="collapsed ? 'Expand' : 'Collapse'"
            :aria-expanded="!collapsed"
            :aria-controls="`entry-body-${entry.id}`"
            :data-test="`entry-collapse-${entry.id}`"
            @click="collapsed = !collapsed"
          />
          <span v-if="supersetLabel" class="shrink-0 font-mono text-xs font-semibold text-dimmed" :data-test="`entry-superset-${entry.id}`">{{ supersetLabel }}</span>
          <NuxtLink
            :to="`/workouts/exercises/${entry.exerciseId}`"
            class="min-w-0 truncate font-semibold text-highlighted"
            :data-test="`entry-link-${entry.id}`"
          >
            {{ entry.exerciseName }}
          </NuxtLink>
          <UBadge
            v-if="targetLabel"
            :label="targetLabel"
            :color="targetMet ? 'success' : 'neutral'"
            variant="subtle"
            size="sm"
            class="shrink-0"
            :data-test="`entry-target-${entry.id}`"
          />
          <UBadge
            v-else-if="entry.sets.length > 0"
            :label="plural(entry.sets.length, 'set')"
            variant="subtle"
            size="sm"
            class="shrink-0"
            :data-test="`entry-sets-${entry.id}`"
          />
          <div class="ml-auto flex shrink-0 items-center">
            <UButton
              icon="i-lucide-history"
              variant="ghost"
              color="neutral"
              class="size-10 justify-center max-sm:hidden"
              aria-label="Exercise history"
              :to="`/workouts/exercises/${entry.exerciseId}?tab=history`"
              :data-test="`entry-history-${entry.id}`"
            />
            <UDropdownMenu :items="menu">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                variant="ghost"
                color="neutral"
                class="size-10 justify-center"
                aria-label="Exercise actions"
                :data-test="`entry-menu-${entry.id}`"
              />
              <template #item-label="{ item }">
                <span :data-test="item.testId">{{ item.label }}</span>
              </template>
            </UDropdownMenu>
          </div>
        </div>
        <p v-if="entry.notes" class="pl-11 text-xs text-dimmed" :data-test="`entry-notes-${entry.id}`">{{ entry.notes }}</p>
        <div
          v-if="entry.optional || showBar || entry.lastSets.length > 0"
          class="flex flex-wrap items-center gap-x-3 gap-y-1 pl-11 text-xs leading-snug text-dimmed"
        >
          <UBadge v-if="entry.optional" label="optional" variant="outline" color="neutral" size="sm" class="shrink-0" :data-test="`entry-optional-${entry.id}`" />
          <span v-if="showBar" class="inline-flex items-center">
            Bar: {{ entry.barWeight }} lb
            <UButton
              v-if="plateButton"
              label="Plates"
              icon="i-lucide-disc-3"
              variant="subtle"
              color="neutral"
              size="xs"
              class="ml-2.5 min-h-10"
              :data-test="`entry-plates-${entry.id}`"
              @click="emit('plates', plateWeight)"
            />
          </span>
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
      </div>
    </template>

    <div v-show="!collapsed" :id="`entry-body-${entry.id}`" class="flex flex-col gap-4" :data-test="`entry-body-${entry.id}`">
      <div v-if="entry.sets.length > 0" class="flex flex-col gap-2 max-sm:gap-1">
        <div v-for="(set, index) in entry.sets" :key="set.id" data-test="set-row">
          <WorkoutSetRow
            :set="set"
            :index="index"
            :tracking-type="entry.trackingType"
            :load-style="entry.loadStyle"
            :weight-increment="entry.weightIncrement"
            :error="errorFor(set.id)"
            @save="(values) => emit('editSet', set.id, values)"
            @remove="emit('removeSet', set.id)"
          />
          <div v-if="errorFor(set.id)" class="flex items-center gap-2 px-3 pt-1" :data-test="`set-save-error-${set.id}`">
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
        <div v-if="totalVolume" class="flex justify-end px-3">
          <span class="text-xs font-medium text-dimmed" :data-test="`entry-volume-${entry.id}`">Total Volume: {{ totalVolume }} lb</span>
        </div>
        <USeparator />
      </div>

      <WorkoutSetForm
        :entry="entry"
        :preset-weight="presetWeight"
        :progression="progression"
        :choice="choice"
        @save="(values) => emit('addSet', values)"
        @choose="choose"
        @weight="(value) => (formWeight = value)"
      />
      <div v-if="errorFor(null)" class="flex items-center gap-2 pt-1" data-test="set-save-error-new">
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

    <WorkoutProgressionPrompt v-model:open="promptOpen" :copy="copy" :kind="progression?.kind ?? 'add'" @choose="choose" />

    <UModal
      v-model:open="confirmRemoveOpen"
      :title="`Remove ${entry.exerciseName}?`"
      description="This will remove the exercise and all logged sets."
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="confirmRemoveOpen = false" />
        <UButton label="Remove" color="error" class="min-h-10" :data-test="`entry-remove-confirm-${entry.id}`" @click="confirmRemove" />
      </template>
    </UModal>
  </UCard>
</template>
