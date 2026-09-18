<script setup lang="ts">
import type { EquipmentRow, Exercise, ExerciseCategory, LoadStyle, TrackingType } from '~~/shared/types/workout'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '~~/shared/types/workout'
import { LOAD_STYLE_LABELS, TRACKING_TYPE_LABELS, WEIGHT_TRACKING_TYPES } from '~~/shared/utils/exerciseLabels'

// Narrower than MuscleRow (drops categoryKey/bodyMapGroups) since the form only renders key + name chips.
interface MuscleOption { key: string, name: string }

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
}>()

const emit = defineEmits<{ submit: [payload: ExerciseFormPayload] }>()
const open = defineModel<boolean>('open', { default: false })

const EQUIPMENT_LIMIT = 4
const MUSCLE_LIMIT = 6

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
    name: exercise?.name ?? '',
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

function selectLoadStyle(style: LoadStyle) {
  local.loadStyle = style
  local.barWeight = style === 'barbell' ? (local.barWeight ?? 45) : null
}

function toggleEquipment(key: string) {
  if (local.equipment.includes(key)) {
    local.equipment = local.equipment.filter((k) => k !== key)
    return
  }
  if (local.equipment.length >= EQUIPMENT_LIMIT) return
  local.equipment = [...local.equipment, key]
}

function togglePrimary(key: string) {
  if (local.primaryMuscles.includes(key)) {
    local.primaryMuscles = local.primaryMuscles.filter((k) => k !== key)
    return
  }
  if (local.primaryMuscles.length >= MUSCLE_LIMIT) return
  local.primaryMuscles = [...local.primaryMuscles, key]
  local.secondaryMuscles = local.secondaryMuscles.filter((k) => k !== key)
}

function secondaryDisabled(key: string): boolean {
  if (local.primaryMuscles.includes(key)) return true
  return !local.secondaryMuscles.includes(key) && local.secondaryMuscles.length >= MUSCLE_LIMIT
}

function toggleSecondary(key: string) {
  if (local.primaryMuscles.includes(key)) return
  if (local.secondaryMuscles.includes(key)) {
    local.secondaryMuscles = local.secondaryMuscles.filter((k) => k !== key)
    return
  }
  if (local.secondaryMuscles.length >= MUSCLE_LIMIT) return
  local.secondaryMuscles = [...local.secondaryMuscles, key]
}

const clientError = ref<string | null>(null)
const serverError = ref<string | null>(props.nameError ?? null)
watch(() => props.nameError, (value) => {
  serverError.value = value ?? null
})
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
        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Name</span>
          <UInput v-model="local.name" placeholder="Exercise name" class="w-full" data-test="exercise-name" />
          <p v-if="nameFieldError" class="text-sm text-error">{{ nameFieldError }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Category</span>
          <USelect
            v-model="local.categoryId"
            :items="categoryOptions"
            :disabled="categories.length === 0"
            class="w-full"
            data-test="exercise-category"
          />
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Tracking type</span>
          <USelect
            v-model="trackingTypeModel"
            :items="trackingTypeOptions"
            class="w-full"
            data-test="exercise-tracking-type"
          />
        </div>

        <div v-if="showLoadStyle" class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Load style</span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="style in LOAD_STYLE_VALUES"
              :key="style"
              :label="LOAD_STYLE_LABELS[style]"
              class="min-h-10"
              :color="local.loadStyle === style ? 'primary' : 'neutral'"
              :variant="local.loadStyle === style ? 'solid' : 'soft'"
              :aria-pressed="local.loadStyle === style"
              :data-test="`exercise-load-${style}`"
              @click="selectLoadStyle(style)"
            />
          </div>
        </div>

        <div v-if="showBarWeight" class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Bar weight</span>
          <AppNumberInput v-model="local.barWeight" :min="1" :step="5" class="w-full" data-test="exercise-bar-weight" />
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Equipment</span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in equipment"
              :key="item.key"
              :label="item.name"
              class="min-h-10"
              :color="local.equipment.includes(item.key) ? 'primary' : 'neutral'"
              :variant="local.equipment.includes(item.key) ? 'solid' : 'soft'"
              :aria-pressed="local.equipment.includes(item.key)"
              :disabled="!local.equipment.includes(item.key) && local.equipment.length >= EQUIPMENT_LIMIT"
              :data-test="`exercise-equipment-${item.key}`"
              @click="toggleEquipment(item.key)"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Primary muscles</span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in muscles"
              :key="item.key"
              :label="item.name"
              class="min-h-10"
              :color="local.primaryMuscles.includes(item.key) ? 'primary' : 'neutral'"
              :variant="local.primaryMuscles.includes(item.key) ? 'solid' : 'soft'"
              :aria-pressed="local.primaryMuscles.includes(item.key)"
              :disabled="!local.primaryMuscles.includes(item.key) && local.primaryMuscles.length >= MUSCLE_LIMIT"
              :data-test="`exercise-muscle-${item.key}`"
              @click="togglePrimary(item.key)"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Secondary muscles</span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in muscles"
              :key="item.key"
              :label="item.name"
              class="min-h-10"
              :color="local.secondaryMuscles.includes(item.key) ? 'primary' : 'neutral'"
              :variant="local.secondaryMuscles.includes(item.key) ? 'solid' : 'soft'"
              :aria-pressed="local.secondaryMuscles.includes(item.key)"
              :disabled="secondaryDisabled(item.key)"
              :data-test="`exercise-secondary-${item.key}`"
              @click="toggleSecondary(item.key)"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <span class="text-sm font-medium text-dimmed">Notes</span>
          <UTextarea v-model="local.notes" :rows="3" class="w-full" data-test="exercise-notes" />
        </div>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Save"
        class="min-h-10 w-full"
        :disabled="categories.length === 0"
        data-test="exercise-submit"
        @click="submit"
      />
    </template>
  </AppSheet>
</template>
