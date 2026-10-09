<script setup lang="ts">
import type { SetMeasures, WorkoutEntry } from '~~/shared/types/workout'
import { rangePlaceholder, targetMetricFor } from '~~/shared/utils/workoutTargets'
import { prefillFor } from '~~/shared/utils/workoutPrefill'
import { progressionCopy, type Progression } from '~~/shared/utils/workoutProgression'
import { FIELD, LABEL, measuresFor, type SetMeasure } from '~~/shared/utils/setRules'
import WorkoutPlateCircles from '~/components/workout/WorkoutPlateCircles.vue'

const props = withDefaults(defineProps<{
  entry: WorkoutEntry
  presetWeight?: { weight: number, seq: number } | null
  progression?: Progression | null
  choice?: 'apply' | 'stay' | null
}>(), {
  presetWeight: null,
  progression: null,
  choice: null
})

const emit = defineEmits<{
  save: [values: SetMeasures]
  choose: [choice: 'apply' | 'stay']
  weight: [value: number | null]
}>()

const measures = computed(() => measuresFor(props.entry.trackingType))
const metric = computed(() => targetMetricFor(props.entry.trackingType))
const rangeHint = computed(() => (props.entry.target && metric.value ? rangePlaceholder(props.entry.target.low, props.entry.target.high, metric.value) ?? undefined : undefined))
const setNumber = computed(() => props.entry.sets.length + 1)
const circles = computed(() =>
  props.entry.loadStyle === 'barbell' && props.entry.barWeight != null && props.entry.plateSizes != null)
const cardioMeasures = computed(() =>
  measures.value.filter((measure) => (measure !== 'weight' && measure !== 'reps') || (measure === 'weight' && !circles.value)))
const showWeightHero = computed(() => measures.value.includes('weight') && circles.value)
const showReps = computed(() => measures.value.includes('reps'))

const copy = computed(() =>
  props.progression ? progressionCopy(props.progression, props.entry.loadStyle, props.entry.target) : null)
const pending = computed(() => (props.choice === null ? copy.value : null))
const CALLOUT = {
  add: {
    box: 'border-primary/30 bg-primary/10', icon: 'i-lucide-trending-up', text: 'text-primary', button: 'primary'
  },
  drop: {
    box: 'border-warning/30 bg-warning/10', icon: 'i-lucide-trending-down', text: 'text-warning', button: 'warning'
  }
} as const
const tone = computed(() => CALLOUT[props.progression?.kind ?? 'add'])

function suggestedWeight(choice: 'apply' | 'stay' | null) {
  const p = props.progression
  if (!p) return null
  return choice === 'apply' ? p.weight : p.fromWeight
}

function seed(): SetMeasures {
  const source = prefillFor(props.entry.sets, props.entry.lastSets)
  const targetWeight = props.entry.sets.length === 0 ? props.entry.target?.weight ?? null : null
  return {
    weight: suggestedWeight(props.choice) ?? targetWeight ?? source.weight ?? null,
    reps: source.reps ?? null,
    distanceMeters: source.distanceMeters ?? null,
    durationSeconds: source.durationSeconds ?? null
  }
}

let seeded = seed()
const values = reactive<SetMeasures>({ ...seeded })
const untouched = () => (Object.keys(seeded) as (keyof SetMeasures)[]).every((key) => values[key] === seeded[key])

// A delete keeps what the user typed; a new set or a changed suggestion always re-seeds.
watch([() => props.entry.sets.length, () => props.progression?.kind, () => props.progression?.weight], ([length], [previous]) => {
  if (length < previous && !untouched()) return
  seeded = seed()
  Object.assign(values, seeded)
})

watch(() => props.choice, (choice) => {
  if (props.progression && choice) values.weight = suggestedWeight(choice)
})

watch(() => values.weight, (weight) => emit('weight', weight ?? null), { immediate: true })

// The seq lets the same weight be applied again after the user edited the field.
watch(() => props.presetWeight?.seq, () => {
  if (props.presetWeight && measures.value.includes('weight')) values.weight = props.presetWeight.weight
}, { immediate: true })

const UNIT: Record<string, string> = { weight: ' (lb)', distance: ' (mi)', duration: ' (m:ss)' }
const cardioFields = computed(() => cardioMeasures.value.map((measure: SetMeasure) => {
  const weight = measure === 'weight'
  return {
    measure,
    key: FIELD[measure],
    box: weight ? '' : 'w-full max-w-72 sm:w-auto',
    width: weight ? 'w-48' : 'w-full sm:w-48',
    base: weight ? 'text-center text-lg font-semibold' : 'text-center',
    step: weight ? props.entry.weightIncrement ?? 5 : measure === 'distance' ? 0.1 : 30,
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

    <div
      v-if="pending"
      class="flex flex-col gap-3 rounded-lg border p-3"
      :class="tone.box"
      data-test="set-progression-callout"
    >
      <div class="flex flex-col gap-1">
        <p
          class="flex items-center gap-2 text-base font-semibold"
          :class="tone.text"
          data-test="set-progression-heading"
        >
          <UIcon :name="tone.icon" class="size-5 shrink-0" />
          {{ pending.title }}
        </p>
        <p class="text-sm text-toned" data-test="set-progression-body">
          {{ pending.bodyParts.before }}<span class="whitespace-nowrap">{{ pending.bodyParts.range }}</span>{{ pending.bodyParts.after }}
        </p>
      </div>
      <div class="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        <UButton
          :label="pending.apply"
          :color="tone.button"
          block
          class="min-h-10"
          data-test="set-progression-apply"
          @click="emit('choose', 'apply')"
        />
        <UButton
          :label="pending.stay"
          variant="soft"
          color="neutral"
          block
          class="min-h-10"
          data-test="set-progression-stay"
          @click="emit('choose', 'stay')"
        />
      </div>
    </div>

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
      <div v-for="field in cardioFields" :key="field.measure" class="flex flex-col items-center gap-1" :class="field.box">
        <span class="text-sm text-dimmed">{{ LABEL[field.measure] }}{{ UNIT[field.measure] ?? '' }}</span>
        <div :class="field.width">
          <AppMilesInput
            v-if="field.measure === 'distance'"
            v-model="values[field.key]"
            :step="field.step"
            :aria-label="LABEL[field.measure]"
            :placeholder="field.placeholder"
            :ui="{ base: field.base }"
            :data-test="field.testId"
          />
          <AppDurationInput
            v-else-if="field.measure === 'duration'"
            v-model="values[field.key]"
            :step="field.step"
            :aria-label="LABEL[field.measure]"
            :placeholder="field.placeholder"
            :ui="{ base: field.base }"
            :data-test="field.testId"
          />
          <AppNumberInput
            v-else
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
          v-if="field.measure === 'weight' && entry.loadStyle === 'assisted' && (values.weight ?? 0) > 0"
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
