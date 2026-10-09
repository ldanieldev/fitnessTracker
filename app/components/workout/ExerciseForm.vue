<script setup lang="ts">
import type { EquipmentRow, Exercise, ExerciseCategory, LoadStyle, TrackingType } from '~~/shared/types/workout'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '~~/shared/types/workout'
import { LOAD_STYLE_LABELS, TRACKING_TYPE_LABELS, WEIGHT_TRACKING_TYPES } from '~~/shared/utils/exerciseLabels'
import ExerciseChipGroup from './ExerciseChipGroup.vue'

// Narrower than MuscleRow (drops categoryKey/bodyMapGroups) since the form only renders key + name chips.
interface MuscleOption {
  key: string
  name: string
}

export interface ExerciseFormPayload {
  name: string
  categoryId: number
  trackingType: TrackingType
  loadStyle?: LoadStyle | null
  barWeight?: number | null
  equipment: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  notes: string | null
}

const props = defineProps<{
  exercise?: Exercise
  categories: ExerciseCategory[]
  muscles: MuscleOption[]
  equipment: EquipmentRow[]
  nameError?: string | null
  initialName?: string
  busy?: boolean
}>()

const emit = defineEmits<{ submit: [payload: ExerciseFormPayload] }>()
const open = defineModel<boolean>('open', { default: false })

const EQUIPMENT_LIMIT = 4
const MUSCLE_LIMIT = 6
const LABEL_UI = { label: 'text-dimmed' }

interface LocalState {
  name: string
  categoryId: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  barWeight: number | null
  equipment: string[]
  primaryMuscles: string[]
  secondaryMuscles: string[]
  notes: string
}

function buildDefaults(exercise: Exercise | undefined): LocalState {
  const trackingType = exercise?.trackingType ?? 'weight_reps'
  const loadStyle = exercise?.loadStyle ?? (WEIGHT_TRACKING_TYPES.includes(trackingType) ? 'plain' : null)
  return {
    name: exercise?.name ?? props.initialName ?? '',
    categoryId: exercise?.category.id ?? props.categories[0]?.id ?? 0,
    trackingType,
    loadStyle,
    barWeight: exercise?.barWeight ?? (loadStyle === 'barbell' ? 45 : null),
    equipment: exercise ? [...exercise.equipment] : [],
    primaryMuscles: exercise ? [...exercise.primaryMuscles] : [],
    secondaryMuscles: exercise ? [...exercise.secondaryMuscles] : [],
    notes: exercise?.notes ?? ''
  }
}

const local = reactive<LocalState>(buildDefaults(props.exercise))

function sync() {
  Object.assign(local, buildDefaults(props.exercise))
}

watch(open, (isOpen) => {
  if (isOpen) sync()
})
watch(() => props.exercise, sync)

const title = computed(() => (props.exercise ? 'Edit exercise' : 'New exercise'))
const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })))
const trackingTypeOptions = TRACKING_TYPE_VALUES.map((value) => ({ label: TRACKING_TYPE_LABELS[value], value }))

const showLoadStyle = computed(() => WEIGHT_TRACKING_TYPES.includes(local.trackingType))
const showBarWeight = computed(() => showLoadStyle.value && local.loadStyle === 'barbell')

const trackingTypeModel = computed({
  get: () => local.trackingType,
  set: (value: TrackingType) => {
    local.trackingType = value
    if (WEIGHT_TRACKING_TYPES.includes(value)) {
      if (local.loadStyle === null) local.loadStyle = 'plain'
    } else {
      local.loadStyle = null
      local.barWeight = null
    }
  }
})

const loadStyleItems = LOAD_STYLE_VALUES.map((value) => ({ key: value, name: LOAD_STYLE_LABELS[value] }))

function selectLoadStyle(key: string) {
  const style = LOAD_STYLE_VALUES.find((value) => value === key)
  if (!style) return
  local.loadStyle = style
  local.barWeight = style === 'barbell' ? (local.barWeight ?? 45) : null
}

function toggleKey(list: string[], key: string, limit: number): string[] {
  if (list.includes(key)) return list.filter((k) => k !== key)
  return list.length >= limit ? list : [...list, key]
}

function atLimit(list: string[], key: string, limit: number): boolean {
  return !list.includes(key) && list.length >= limit
}

function toggleEquipment(key: string) {
  local.equipment = toggleKey(local.equipment, key, EQUIPMENT_LIMIT)
}

function togglePrimary(key: string) {
  local.primaryMuscles = toggleKey(local.primaryMuscles, key, MUSCLE_LIMIT)
  if (local.primaryMuscles.includes(key)) local.secondaryMuscles = local.secondaryMuscles.filter((k) => k !== key)
}

function toggleSecondary(key: string) {
  if (local.primaryMuscles.includes(key)) return
  local.secondaryMuscles = toggleKey(local.secondaryMuscles, key, MUSCLE_LIMIT)
}

const equipmentDisabled = (key: string) => atLimit(local.equipment, key, EQUIPMENT_LIMIT)
const primaryDisabled = (key: string) => atLimit(local.primaryMuscles, key, MUSCLE_LIMIT)
const secondaryDisabled = (key: string) =>
  local.primaryMuscles.includes(key) || atLimit(local.secondaryMuscles, key, MUSCLE_LIMIT)

const clientError = ref<string | null>(null)
const serverError = ref<string | null>(props.nameError ?? null)
watch(
  () => props.nameError,
  (value) => {
    serverError.value = value ?? null
  }
)
const nameFieldError = computed(() => clientError.value ?? serverError.value)

function buildPayload(): ExerciseFormPayload {
  return {
    name: local.name.trim(),
    categoryId: local.categoryId,
    trackingType: local.trackingType,
    // Always sent (never omitted) so a switch away from a weight-bearing type clears stale server values.
    loadStyle: showLoadStyle.value ? local.loadStyle : null,
    barWeight: showBarWeight.value ? local.barWeight : null,
    equipment: [...local.equipment],
    primaryMuscles: [...local.primaryMuscles],
    secondaryMuscles: [...local.secondaryMuscles],
    notes: local.notes.trim() === '' ? null : local.notes.trim()
  }
}

function submit() {
  // EL-R24: clear the server-side copy on the next attempt so a stale duplicate-name message doesn't linger.
  serverError.value = null
  if (!local.name.trim()) {
    clientError.value = 'Name is required'
    return
  }
  clientError.value = null
  emit('submit', buildPayload())
}
</script>

<template>
  <AppSheet v-model:open="open" :title="title">
    <template #body>
      <div class="flex flex-col gap-4">
        <UFormField label="Name" :error="nameFieldError ?? undefined" :ui="LABEL_UI">
          <UInput v-model="local.name" placeholder="Exercise name" class="w-full" data-test="exercise-name" />
        </UFormField>

        <UFormField label="Category" :ui="LABEL_UI">
          <USelect
            v-model="local.categoryId"
            :items="categoryOptions"
            :disabled="categories.length === 0"
            class="w-full"
            data-test="exercise-category"
          />
        </UFormField>

        <UFormField label="Tracking type" :ui="LABEL_UI">
          <USelect
            v-model="trackingTypeModel"
            :items="trackingTypeOptions"
            class="w-full"
            data-test="exercise-tracking-type"
          />
        </UFormField>

        <ExerciseChipGroup
          v-if="showLoadStyle"
          legend="Load style"
          :items="loadStyleItems"
          :selected="local.loadStyle ? [local.loadStyle] : []"
          test-prefix="exercise-load"
          @toggle="selectLoadStyle"
        />

        <UFormField v-if="showBarWeight" label="Bar weight" :ui="LABEL_UI">
          <AppNumberInput v-model="local.barWeight" :min="1" :step="5" class="w-full" data-test="exercise-bar-weight" />
        </UFormField>

        <ExerciseChipGroup
          legend="Equipment"
          :items="equipment"
          :selected="local.equipment"
          :is-disabled="equipmentDisabled"
          test-prefix="exercise-equipment"
          @toggle="toggleEquipment"
        />

        <ExerciseChipGroup
          legend="Primary muscles"
          :items="muscles"
          :selected="local.primaryMuscles"
          :is-disabled="primaryDisabled"
          test-prefix="exercise-muscle"
          @toggle="togglePrimary"
        />

        <ExerciseChipGroup
          legend="Secondary muscles"
          :items="muscles"
          :selected="local.secondaryMuscles"
          :is-disabled="secondaryDisabled"
          test-prefix="exercise-secondary"
          @toggle="toggleSecondary"
        />

        <UFormField label="Notes" :ui="LABEL_UI">
          <UTextarea v-model="local.notes" :rows="3" class="w-full" data-test="exercise-notes" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Save"
        class="min-h-10 w-full"
        :disabled="categories.length === 0 || busy"
        data-test="exercise-submit"
        @click="submit"
      />
    </template>
  </AppSheet>
</template>
