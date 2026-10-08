<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { LoadStyle, SetMeasures, SetRecordKind, TrackingType, WorkoutSet } from '~~/shared/types/workout'
import { FIELD, LABEL, measuresFor, type SetMeasure } from '~~/shared/utils/setRules'
import { measureText } from '~~/shared/utils/setFormat'

const props = withDefaults(defineProps<{
  set: WorkoutSet
  index: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  weightIncrement?: number | null
  error?: string | null
}>(), {
  weightIncrement: null,
  error: null
})

const emit = defineEmits<{
  save: [values: SetMeasures & { comment?: string }]
  remove: []
}>()

const RECORD_LABEL: Record<SetRecordKind, string> = {
  weight_reps: 'Record: weight × reps',
  reps: 'Record: reps',
  distance: 'Record: distance',
  pace: 'Record: pace'
}

const EDIT_UNIT: Record<SetMeasure, string> = { weight: 'lb', reps: 'reps', distance: 'mi', duration: 'm:ss' }
const STEP: Record<SetMeasure, number> = { weight: 5, reps: 1, distance: 0.1, duration: 30 }

// The 40 px steppers leave little room at 360 px, so the input gives up its side padding.
const INPUT_UI = { base: 'px-1' }

const measures = computed(() => measuresFor(props.trackingType))
const editing = ref(false)
const noteOpen = ref(Boolean(props.set.comment))
const noteText = ref(props.set.comment ?? '')
const noteFocused = ref(false)
const menuOpen = ref(false)
const pendingSave = ref<SetMeasures | null>(null)
const saving = ref(false)

function measuresOf(set: WorkoutSet): SetMeasures {
  return { weight: set.weight, reps: set.reps, distanceMeters: set.distanceMeters, durationSeconds: set.durationSeconds }
}

function sameMeasures(a: SetMeasures, b: SetMeasures) {
  return a.weight === b.weight && a.reps === b.reps && a.distanceMeters === b.distanceMeters && a.durationSeconds === b.durationSeconds
}

const draft = reactive<SetMeasures>(measuresOf(props.set))

watch(() => props.set, (set) => {
  if (pendingSave.value && sameMeasures(measuresOf(set), pendingSave.value)) {
    // A Retry of an older payload can land after the user changed the draft; keep the form so the newer edits survive.
    if (sameMeasures(draft, pendingSave.value)) editing.value = false
    pendingSave.value = null
    saving.value = false
  }
  if (!editing.value) Object.assign(draft, measuresOf(set))
  if (!noteFocused.value) noteText.value = set.comment ?? ''
  if (set.comment) noteOpen.value = true
})

watch(() => props.error, (error) => {
  if (error) saving.value = false
})

function display(measure: SetMeasure) {
  const value = props.set[FIELD[measure]]
  if (value === null || value === undefined) return ''
  if (measure === 'reps') return `${value} reps`
  const sign = measure === 'weight' && props.loadStyle === 'assisted' ? '−' : ''
  return `${sign}${measureText(measure, value)}`
}

const volume = computed(() => {
  if (!measures.value.includes('weight') || !measures.value.includes('reps')) return null
  if (props.set.weight == null || props.set.reps == null) return null
  return (props.set.weight * props.set.reps).toLocaleString()
})

const recordLabel = computed(() => props.set.records.map((record) => RECORD_LABEL[record.kind]).join(', '))

const menu = computed<DropdownMenuItem[][]>(() => [
  ...(volume.value
    ? [[{ label: `${volume.value} vol`, icon: 'i-lucide-sigma', disabled: true, testId: `set-volume-menu-${props.set.id}` }]]
    : []),
  [{ label: 'Edit', icon: 'i-lucide-pencil', testId: `set-edit-${props.set.id}`, onSelect: startEdit }],
  [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', testId: `set-remove-${props.set.id}`, onSelect: () => emit('remove') }]
])

// Unmounting the read line while Reka still has the menu open strands `body { pointer-events: none }`, so the close has to land first (LR-R8).
function startEdit() {
  Object.assign(draft, measuresOf(props.set))
  menuOpen.value = false
  nextTick(() => {
    editing.value = true
  })
}

function cancelEdit() {
  pendingSave.value = null
  saving.value = false
  editing.value = false
}

// Edit mode ends when the saved values come back (also via the card's Retry), so a failed save keeps what was typed.
function saveEdit() {
  pendingSave.value = { ...draft }
  saving.value = true
  emit('save', { ...draft })
}

function draftValue(measure: SetMeasure): number | null {
  return draft[FIELD[measure]] ?? null
}

function stepFor(measure: SetMeasure) {
  return measure === 'weight' ? (props.weightIncrement ?? STEP.weight) : STEP[measure]
}

function saveNote() {
  noteFocused.value = false
  if (noteText.value === (props.set.comment ?? '')) return
  emit('save', { comment: noteText.value })
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div v-if="editing" class="flex flex-col gap-2 rounded-lg bg-elevated/50 px-3 py-2" :data-test="`set-edit-form-${set.id}`">
      <div class="flex flex-wrap items-center gap-2">
        <span class="w-12 shrink-0 text-sm text-dimmed">Set {{ index + 1 }}</span>
        <div v-for="measure in measures" :key="measure" class="flex min-w-0 basis-full items-center gap-1 sm:basis-auto sm:flex-1">
          <div class="min-w-0 flex-1">
            <AppMilesInput
              v-if="measure === 'distance'"
              :model-value="draftValue(measure)"
              :step="stepFor(measure)"
              :aria-label="LABEL[measure]"
              :ui="INPUT_UI"
              :disabled="saving"
              :data-test="`set-${measure}-${set.id}`"
              @update:model-value="(value) => (draft[FIELD[measure]] = value)"
            />
            <AppDurationInput
              v-else-if="measure === 'duration'"
              :model-value="draftValue(measure)"
              :step="stepFor(measure)"
              :aria-label="LABEL[measure]"
              :ui="INPUT_UI"
              :disabled="saving"
              :data-test="`set-${measure}-${set.id}`"
              @update:model-value="(value) => (draft[FIELD[measure]] = value)"
            />
            <AppNumberInput
              v-else
              :model-value="draftValue(measure)"
              :min="0"
              :step="stepFor(measure)"
              :aria-label="LABEL[measure]"
              :ui="INPUT_UI"
              :disabled="saving"
              :data-test="`set-${measure}-${set.id}`"
              @update:model-value="(value) => (draft[FIELD[measure]] = value)"
            />
          </div>
          <span class="text-xs text-dimmed">{{ EDIT_UNIT[measure] }}</span>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" variant="ghost" color="neutral" class="min-h-10" :data-test="`set-cancel-${set.id}`" @click="cancelEdit" />
        <UButton label="Save" class="min-h-10" :loading="saving" :data-test="`set-save-${set.id}`" @click="saveEdit" />
      </div>
    </div>

    <div v-else class="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg bg-elevated/50 max-sm:gap-x-2  text-sm" :data-test="`set-line-${set.id}`">
      <span class="w-16 shrink-0 text-dimmed">Set {{ index + 1 }}</span>
      <span v-for="measure in measures" :key="measure" class="font-medium" :data-test="`set-measure-${set.id}-${measure}`">{{ display(measure) }}</span>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <UIcon
          v-if="set.records.length > 0"
          name="i-lucide-trophy"
          class="size-5 text-warning"
          :aria-label="recordLabel"
          :data-test="`set-record-${set.id}`"
        />
        <span v-if="volume" class="text-dimmed max-sm:hidden" :data-test="`set-volume-${set.id}`">{{ volume }} vol</span>
        <UButton
          icon="i-lucide-message-square"
          variant="ghost"
          :color="set.comment ? 'primary' : 'neutral'"
          class="size-10 justify-center"
          aria-label="Set note"
          :data-test="`set-comment-${set.id}`"
          @click="noteOpen = !noteOpen"
        />
        <UDropdownMenu v-model:open="menuOpen" :items="menu">
          <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Set actions" :data-test="`set-menu-${set.id}`" />
          <template #item-label="{ item }">
            <span :data-test="item.testId">{{ item.label }}</span>
          </template>
        </UDropdownMenu>
      </div>
    </div>

    <UTextarea
      v-if="noteOpen && !editing"
      v-model="noteText"
      placeholder="Add a note…"
      :rows="1"
      autoresize
      size="sm"
      class="mx-3"
      :data-test="`set-note-${set.id}`"
      @focus="noteFocused = true"
      @blur="saveNote"
    />
  </div>
</template>
