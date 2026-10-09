<script setup lang="ts">
import type { RoutineEntry, RoutineEntryPatch } from '~~/shared/types/routine'
import type { TargetMetric } from '~~/shared/types/workout'
import { measuresFor } from '~~/shared/utils/setRules'
import { targetMetricFor } from '~~/shared/utils/workoutTargets'

const props = defineProps<{ entry: RoutineEntry | null; busy?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [patch: RoutineEntryPatch]; remove: [] }>()

const RANGE_UNIT: Record<TargetMetric, string> = { reps: 'reps', time: 'm:ss', distance: 'mi' }

const form = reactive({
  targetSets: null as number | null,
  targetLow: null as number | null,
  targetHigh: null as number | null,
  targetWeight: null as number | null,
  restSeconds: null as number | null,
  optional: false,
  notes: ''
})
const error = ref<string | null>(null)

watch(
  [open, () => props.entry],
  ([isOpen, entry]) => {
    if (!isOpen || !entry) return
    form.targetSets = entry.target?.sets ?? null
    form.targetLow = entry.target?.low ?? null
    form.targetHigh = entry.target?.high ?? null
    form.targetWeight = entry.target?.weight ?? null
    form.restSeconds = entry.restSeconds
    form.optional = entry.optional
    form.notes = entry.notes ?? ''
    error.value = null
  },
  { immediate: true }
)

const metric = computed(() => (props.entry ? targetMetricFor(props.entry.trackingType) : null))
const hasWeight = computed(() => (props.entry ? measuresFor(props.entry.trackingType).includes('weight') : false))

function save() {
  if (form.targetLow !== null && form.targetHigh !== null && form.targetLow > form.targetHigh) {
    error.value = 'The range must run low to high'
    return
  }
  open.value = false
  emit('save', {
    targetSets: form.targetSets,
    targetLow: metric.value ? form.targetLow : null,
    targetHigh: metric.value ? form.targetHigh : null,
    targetWeight: hasWeight.value ? form.targetWeight : null,
    restSeconds: form.restSeconds,
    optional: form.optional,
    notes: form.notes.trim() || null
  })
}

function remove() {
  open.value = false
  emit('remove')
}
</script>

<template>
  <AppSheet v-model:open="open" :title="entry?.exerciseName ?? 'Exercise'">
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <span class="text-xs text-dimmed">Sets</span>
          <AppNumberInput
            v-model="form.targetSets"
            :min="1"
            :step="1"
            aria-label="Sets"
            data-test="routine-entry-sets"
          />
        </div>
        <div v-if="metric" class="flex flex-col gap-1">
          <span class="text-xs text-dimmed">Range ({{ RANGE_UNIT[metric] }})</span>
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1">
              <AppDurationInput
                v-if="metric === 'time'"
                v-model="form.targetLow"
                :step="15"
                aria-label="Range low"
                data-test="routine-entry-low"
              />
              <AppMilesInput
                v-else-if="metric === 'distance'"
                v-model="form.targetLow"
                :step="0.1"
                aria-label="Range low"
                data-test="routine-entry-low"
              />
              <AppNumberInput
                v-else
                v-model="form.targetLow"
                :min="0"
                :step="1"
                aria-label="Range low"
                data-test="routine-entry-low"
              />
            </div>
            <span class="text-dimmed">–</span>
            <div class="min-w-0 flex-1">
              <AppDurationInput
                v-if="metric === 'time'"
                v-model="form.targetHigh"
                :step="15"
                aria-label="Range high"
                data-test="routine-entry-high"
              />
              <AppMilesInput
                v-else-if="metric === 'distance'"
                v-model="form.targetHigh"
                :step="0.1"
                aria-label="Range high"
                data-test="routine-entry-high"
              />
              <AppNumberInput
                v-else
                v-model="form.targetHigh"
                :min="0"
                :step="1"
                aria-label="Range high"
                data-test="routine-entry-high"
              />
            </div>
          </div>
        </div>
        <div v-if="hasWeight" class="flex flex-col gap-1">
          <span class="text-xs text-dimmed">Weight (lb) — blank = last time</span>
          <AppNumberInput
            v-model="form.targetWeight"
            :min="0"
            :step="5"
            aria-label="Weight"
            data-test="routine-entry-weight"
          />
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs text-dimmed">Rest (sec) — blank = exercise default</span>
          <AppNumberInput
            v-model="form.restSeconds"
            :min="0"
            :step="15"
            aria-label="Rest"
            data-test="routine-entry-rest"
          />
        </div>
        <USwitch v-model="form.optional" label="Optional" data-test="routine-entry-optional" />
        <UInput
          v-model="form.notes"
          placeholder="Note, e.g. per side"
          :maxlength="500"
          data-test="routine-entry-notes"
        />
        <p v-if="error" class="text-sm text-error" data-test="routine-entry-error">{{ error }}</p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2">
        <UButton label="Save" block class="min-h-10" :disabled="busy" data-test="routine-entry-save" @click="save" />
        <UButton
          label="Remove from day"
          color="error"
          variant="ghost"
          block
          class="min-h-10"
          :disabled="busy"
          data-test="routine-entry-remove"
          @click="remove"
        />
      </div>
    </template>
  </AppSheet>
</template>
