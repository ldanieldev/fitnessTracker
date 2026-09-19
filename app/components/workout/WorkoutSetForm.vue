<script setup lang="ts">
import type { SetMeasures, WorkoutEntry } from '~~/shared/types/workout'
import { prefillFor } from '~~/shared/utils/workoutPrefill'
import { LABEL, measuresFor } from '~~/shared/utils/setRules'
import WorkoutPlateCircles from '~/components/workout/WorkoutPlateCircles.vue'

const props = withDefaults(defineProps<{
  entry: WorkoutEntry
  presetWeight?: { weight: number, seq: number } | null
}>(), {
  presetWeight: null
})

const emit = defineEmits<{ save: [values: SetMeasures] }>()

const measures = computed(() => measuresFor(props.entry.trackingType))
const setNumber = computed(() => props.entry.sets.length + 1)
const circles = computed(() =>
  props.entry.loadStyle === 'barbell' && props.entry.barWeight != null && props.entry.plateSizes != null)
const cardioMeasures = computed(() =>
  measures.value.filter((measure) => (measure !== 'weight' && measure !== 'reps') || (measure === 'weight' && !circles.value)))
const showWeightHero = computed(() => measures.value.includes('weight') && circles.value)
const showReps = computed(() => measures.value.includes('reps'))

function seed(): SetMeasures {
  const source = prefillFor(props.entry.sets, props.entry.lastSets)
  return {
    weight: source.weight ?? null,
    reps: source.reps ?? null,
    distanceMeters: source.distanceMeters ?? null,
    durationSeconds: source.durationSeconds ?? null
  }
}

const values = reactive<SetMeasures>(seed())

watch(() => props.entry.sets.length, () => Object.assign(values, seed()))

// The seq lets the same weight be applied again after the user edited the field.
watch(() => props.presetWeight?.seq, () => {
  if (props.presetWeight && measures.value.includes('weight')) values.weight = props.presetWeight.weight
}, { immediate: true })

const STEP = { distance: 100, duration: 30 } as const
const UNIT: Record<string, string> = { weight: ' (lb)', distance: ' (m)', duration: ' (s)' }

function logSet() {
  emit('save', { ...values })
}
</script>

<template>
  <div class="flex flex-col gap-4" data-test="set-form">
    <p class="text-sm font-medium text-dimmed" data-test="set-form-heading">Set {{ setNumber }}</p>

    <div v-if="showWeightHero" class="flex flex-col items-center gap-4">
      <div class="flex flex-col items-center gap-1">
        <span class="text-sm text-dimmed">Weight (lb)</span>
        <div class="flex items-center gap-3">
          <div class="w-48">
            <AppNumberInput
              v-model="values.weight"
              :min="0"
              :step="entry.weightIncrement ?? 5"
              aria-label="Weight"
              :ui="{ base: 'text-center text-lg font-semibold' }"
              data-test="set-weight-new"
            />
          </div>
        </div>
      </div>
      <WorkoutPlateCircles v-model="values.weight" :bar="entry.barWeight!" :sizes="entry.plateSizes!" />
    </div>

    <div v-if="cardioMeasures.length" class="flex flex-col gap-3 sm:flex-row">
      <div v-for="measure in cardioMeasures" :key="measure" class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="text-xs text-dimmed">{{ LABEL[measure] }}{{ UNIT[measure] ?? '' }}</span>
        <AppNumberInput
          v-if="measure === 'weight'"
          v-model="values.weight"
          :min="0"
          :step="entry.weightIncrement ?? 5"
          :aria-label="LABEL[measure]"
          data-test="set-weight-new"
        />
        <AppNumberInput
          v-else-if="measure === 'distance'"
          v-model="values.distanceMeters"
          :min="0"
          :step="STEP.distance"
          :aria-label="LABEL[measure]"
          data-test="set-distance-new"
        />
        <AppNumberInput
          v-else
          v-model="values.durationSeconds"
          :min="0"
          :step="STEP.duration"
          :aria-label="LABEL[measure]"
          data-test="set-duration-new"
        />
        <span
          v-if="measure === 'weight' && entry.loadStyle === 'assisted' && values.weight !== null"
          class="text-xs text-dimmed"
          data-test="set-assist-new"
        >{{ `−${values.weight}` }}</span>
      </div>
    </div>

    <div v-if="showReps" class="flex flex-col items-center gap-1">
      <span class="text-sm text-dimmed">{{ LABEL.reps }}</span>
      <div class="w-40">
        <AppNumberInput v-model="values.reps" :min="0" :step="1" aria-label="Reps" :ui="{ base: 'text-center' }" data-test="set-reps-new" />
      </div>
    </div>

    <UButton label="Log Set" block size="lg" class="min-h-12" data-test="set-save-new" @click="logSet" />
  </div>
</template>
