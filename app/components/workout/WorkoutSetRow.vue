<script setup lang="ts">
import type { LoadStyle, SetMeasures, SetRecordKind, TrackingType, WorkoutSet } from '~~/shared/types/workout'
import { FIELD, LABEL, measuresFor, type SetMeasure } from '~~/shared/utils/setRules'
import { formatSet } from '~~/shared/utils/setFormat'

const props = withDefaults(defineProps<{
  set?: WorkoutSet
  index: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  lastSet: SetMeasures | null
  prefill: SetMeasures
  weightIncrement?: number | null
}>(), {
  weightIncrement: null
})

const emit = defineEmits<{
  save: [values: SetMeasures & { comment?: string }]
  remove: []
  toggleDone: []
}>()

const RECORD_LABEL: Record<SetRecordKind, string> = {
  weight_reps: 'Record: weight × reps',
  reps: 'Record: reps',
  distance: 'Record: distance',
  pace: 'Record: pace'
}

// The 40 px steppers leave ~52 px per field at 360 px, so the input gives up its side padding to keep three digits visible.
const INPUT_UI = { base: 'px-1' }

const measures = computed(() => measuresFor(props.trackingType))
const suffix = computed(() => (props.set ? String(props.set.id) : 'new'))

function seed(): SetMeasures {
  const source = props.set ?? props.prefill
  return {
    weight: source.weight ?? null,
    reps: source.reps ?? null,
    distanceMeters: source.distanceMeters ?? null,
    durationSeconds: source.durationSeconds ?? null
  }
}

const values = reactive<SetMeasures>(seed())
let saved = seed()

watch(() => props.set, () => {
  Object.assign(values, seed())
  saved = seed()
})

function onBlur(measure: SetMeasure) {
  if (!props.set) return
  const field = FIELD[measure]
  if (values[field] === saved[field]) return
  saved = { ...values }
  emit('save', { ...values })
}

function saveNew() {
  emit('save', { ...values })
}

const commentOpen = ref(false)
const commentText = ref('')

function openComment() {
  commentText.value = props.set?.comment ?? ''
  commentOpen.value = true
}

function saveComment() {
  emit('save', { ...values, comment: commentText.value })
  commentOpen.value = false
}

const recordLabel = computed(() =>
  props.set && props.set.records.length > 0 ? props.set.records.map((record) => RECORD_LABEL[record.kind]).join(', ') : ''
)

const lastLine = computed(() => (props.lastSet ? formatSet(measures.value, props.lastSet) : ''))
</script>

<template>
  <div class="flex w-full flex-col gap-1">
    <div class="flex w-full items-center gap-1">
      <span class="w-4 shrink-0 text-sm text-dimmed">{{ index + 1 }}</span>

      <template v-for="measure in measures" :key="measure">
        <div v-if="measure === 'weight'" class="flex min-w-0 flex-1 flex-col gap-0.5">
          <AppNumberInput
            v-model="values.weight"
            :min="0"
            :step="weightIncrement ?? 5"
            :placeholder="LABEL[measure]"
            :aria-label="LABEL[measure]"
            :ui="INPUT_UI"
            :data-test="`set-weight-${suffix}`"
            @blur="onBlur('weight')"
          />
          <span v-if="loadStyle === 'assisted' && values.weight !== null" class="text-xs text-dimmed">{{ `−${values.weight}` }}</span>
        </div>
        <div v-else-if="measure === 'reps'" class="min-w-0 flex-1">
          <AppNumberInput
            v-model="values.reps"
            :min="0"
            :step="1"
            :placeholder="LABEL[measure]"
            :aria-label="LABEL[measure]"
            :ui="INPUT_UI"
            :data-test="`set-reps-${suffix}`"
            @blur="onBlur('reps')"
          />
        </div>
        <div v-else-if="measure === 'distance'" class="min-w-0 flex-1">
          <AppNumberInput
            v-model="values.distanceMeters"
            :min="0"
            :step="100"
            :placeholder="LABEL[measure]"
            :aria-label="LABEL[measure]"
            :ui="INPUT_UI"
            :data-test="`set-distance-${suffix}`"
            @blur="onBlur('distance')"
          />
        </div>
        <div v-else class="min-w-0 flex-1">
          <AppNumberInput
            v-model="values.durationSeconds"
            :min="0"
            :step="30"
            :placeholder="LABEL[measure]"
            :aria-label="LABEL[measure]"
            :ui="INPUT_UI"
            :data-test="`set-duration-${suffix}`"
            @blur="onBlur('duration')"
          />
        </div>
      </template>
    </div>

    <!-- The ± steppers fill the first line at 360 px, so the note and the row's buttons sit on a second one. -->
    <div class="flex items-center gap-2 pl-5">
      <span v-if="lastSet" class="min-w-0 flex-1 truncate text-xs text-dimmed" :data-test="`set-last-${suffix}`">last: {{ lastLine }}</span>

      <div class="ml-auto flex shrink-0 items-center gap-2">
        <UIcon
          v-if="set && set.records.length > 0"
          name="i-lucide-trophy"
          class="size-5 text-warning"
          :aria-label="recordLabel"
          :data-test="`set-record-${suffix}`"
        />

        <UButton
          v-if="set"
          icon="i-lucide-message-square"
          variant="ghost"
          :color="set.comment ? 'primary' : 'neutral'"
          class="size-10"
          aria-label="Set comment"
          :data-test="`set-comment-${suffix}`"
          @click="openComment"
        />

        <UButton
          v-if="set"
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          class="size-10"
          aria-label="Remove set"
          :data-test="`set-remove-${suffix}`"
          @click="emit('remove')"
        />

        <UButton v-else label="Save" class="min-h-10" :data-test="`set-save-${suffix}`" @click="saveNew" />
      </div>
    </div>

    <AppSheet v-if="set" v-model:open="commentOpen" title="Comment">
      <template #body>
        <UTextarea v-model="commentText" :rows="3" autoresize class="w-full" />
      </template>
      <template #footer>
        <UButton label="Save" class="ml-auto" @click="saveComment" />
      </template>
    </AppSheet>
  </div>
</template>
