<script setup lang="ts">
import type { SetMeasures, WorkoutEntry } from '~~/shared/types/workout'
import { rangePlaceholder, targetMetricFor } from '~~/shared/utils/workoutTargets'
import { prefillFor } from '~~/shared/utils/workoutPrefill'
import { FIELD, LABEL, measuresFor, type SetMeasure } from '~~/shared/utils/setRules'
import WorkoutPlateCircles from '~/components/workout/WorkoutPlateCircles.vue'

const props = withDefaults(defineProps<{
  entry: WorkoutEntry
  presetWeight?: { weight: number, seq: number } | null
}>(), {
  presetWeight: null
})

const emit = defineEmits<{ save: [values: SetMeasures] }>()

const measures = computed(() => measuresFor(props.entry.trackingType))
const metric = computed(() => targetMetricFor(props.entry.trackingType))
const rangeHint = computed(() => (props.entry.target ? rangePlaceholder(props.entry.target.low, props.entry.target.high) ?? undefined : undefined))
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
    weight: props.entry.sets.length === 0 && props.entry.target?.weight != null ? props.entry.target.weight : source.weight ?? null,
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

const UNIT: Record<string, string> = { weight: ' (lb)', distance: ' (m)', duration: ' (s)' }
const cardioFields = computed(() => cardioMeasures.value.map((measure: SetMeasure) => {
  const weight = measure === 'weight'
  return {
    measure,
    key: FIELD[measure],
    width: weight ? 'w-48' : 'w-40',
    base: weight ? 'text-center text-lg font-semibold' : 'text-center',
    step: weight ? props.entry.weightIncrement ?? 5 : measure === 'distance' ? 100 : 30,
    placeholder: (measure === 'distance' && metric.value === 'distance') || (measure === 'duration' && metric.value === 'time') ? rangeHint.value : undefined,
    testId: `set-${weight ? 'weight' : measure}-new`
  }
}))

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

    <div v-if="cardioFields.length" class="flex flex-wrap justify-center gap-4">
      <div v-for="field in cardioFields" :key="field.measure" class="flex flex-col items-center gap-1">
        <span class="text-sm text-dimmed">{{ LABEL[field.measure] }}{{ UNIT[field.measure] ?? '' }}</span>
        <div :class="field.width">
          <AppNumberInput
            v-model="values[field.key]"
            :min="0"
            :step="field.step"
            :aria-label="LABEL[field.measure]"
            :placeholder="field.placeholder"
            :ui="{ base: field.base }"
            :data-test="field.testId"
          />
        </div>
        <span
          v-if="field.measure === 'weight' && entry.loadStyle === 'assisted' && values.weight !== null"
          class="text-xs text-dimmed"
          data-test="set-assist-new"
        >{{ `−${values.weight}` }}</span>
      </div>
    </div>

    <div v-if="showReps" class="flex flex-col items-center gap-1">
      <span class="text-sm text-dimmed">{{ LABEL.reps }}</span>
      <div class="w-40">
        <AppNumberInput v-model="values.reps" :min="0" :step="1" aria-label="Reps" :placeholder="metric === 'reps' ? rangeHint : undefined" :ui="{ base: 'text-center' }" data-test="set-reps-new" />
      </div>
    </div>

    <UButton label="Log Set" block size="lg" class="min-h-12" data-test="set-save-new" @click="logSet" />
  </div>
</template>
