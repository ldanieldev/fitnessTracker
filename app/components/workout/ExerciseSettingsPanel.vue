<script setup lang="ts">
import type { Exercise, ExerciseCategory, LoadStyle, TrackingType } from '~~/shared/types/workout'
import { LOAD_STYLE_VALUES, TRACKING_TYPE_VALUES } from '~~/shared/types/workout'
import { LOAD_STYLE_LABELS, TRACKING_TYPE_LABELS, WEIGHT_TRACKING_TYPES } from '~~/shared/utils/exerciseLabels'

const props = withDefaults(defineProps<{ exercise: Exercise, categories?: ExerciseCategory[] }>(), {
  categories: () => []
})
const emit = defineEmits<{ save: [patch: Record<string, unknown>], reset: [field: string] }>()

interface LocalSettings {
  categoryId: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  barWeight: number | null
}

const local = reactive<LocalSettings>({
  categoryId: props.exercise.category.id,
  trackingType: props.exercise.trackingType,
  loadStyle: props.exercise.loadStyle,
  barWeight: props.exercise.barWeight
})

watch(() => props.exercise, (exercise) => {
  local.categoryId = exercise.category.id
  local.trackingType = exercise.trackingType
  local.loadStyle = exercise.loadStyle
  local.barWeight = exercise.barWeight
})

const categoryOptions = computed(() => props.categories.map((c) => ({ label: c.name, value: c.id })))
const trackingTypeOptions = TRACKING_TYPE_VALUES.map((value) => ({ label: TRACKING_TYPE_LABELS[value], value }))
const loadStyleOptions = LOAD_STYLE_VALUES.map((value) => ({ label: LOAD_STYLE_LABELS[value], value }))

const showLoadStyle = computed(() => WEIGHT_TRACKING_TYPES.includes(local.trackingType))
const showBarWeight = computed(() => showLoadStyle.value && local.loadStyle === 'barbell')

// A non-weight tracking type can't carry a load style or bar weight, so a user-driven change clears both.
const trackingTypeModel = computed({
  get: () => local.trackingType,
  set: (value: TrackingType) => {
    local.trackingType = value
    if (!WEIGHT_TRACKING_TYPES.includes(value)) {
      local.loadStyle = null
      local.barWeight = null
    }
  }
})

// Bridges local.loadStyle's nullability past USelect's non-null model type and clears a stale bar weight.
const loadStyleModel = computed({
  get: () => local.loadStyle ?? undefined,
  set: (value: LoadStyle | undefined) => {
    local.loadStyle = value ?? null
    if (local.loadStyle !== 'barbell') local.barWeight = null
  }
})

function save() {
  const patch: Record<string, unknown> = {}
  if (local.categoryId !== props.exercise.category.id) patch.categoryId = local.categoryId
  if (local.trackingType !== props.exercise.trackingType) patch.trackingType = local.trackingType
  if (local.loadStyle !== props.exercise.loadStyle) patch.loadStyle = local.loadStyle
  if (local.barWeight !== props.exercise.barWeight) patch.barWeight = local.barWeight
  if (Object.keys(patch).length === 0) return
  emit('save', patch)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <span class="text-sm font-medium text-dimmed">Category</span>
      <div class="flex items-center gap-2">
        <USelect
          v-model="local.categoryId"
          :items="categoryOptions"
          :disabled="categories.length === 0"
          class="min-w-0 flex-1"
          data-test="setting-category"
        />
        <UButton
          v-if="exercise.overridden.category"
          label="Reset"
          size="sm"
          variant="ghost"
          color="neutral"
          aria-label="Reset category"
          data-test="reset-categoryId"
          @click="emit('reset', 'categoryId')"
        />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <span class="text-sm font-medium text-dimmed">Tracking type</span>
      <div class="flex items-center gap-2">
        <USelect
          v-model="trackingTypeModel"
          :items="trackingTypeOptions"
          class="min-w-0 flex-1"
          data-test="setting-tracking-type"
        />
        <UButton
          v-if="exercise.overridden.trackingType"
          label="Reset"
          size="sm"
          variant="ghost"
          color="neutral"
          aria-label="Reset tracking type"
          data-test="reset-trackingType"
          @click="emit('reset', 'trackingType')"
        />
      </div>
    </div>

    <div v-if="showLoadStyle" class="flex flex-col gap-1">
      <span class="text-sm font-medium text-dimmed">Load style</span>
      <div class="flex items-center gap-2">
        <USelect
          v-model="loadStyleModel"
          :items="loadStyleOptions"
          class="min-w-0 flex-1"
          data-test="setting-load-style"
        />
        <UButton
          v-if="exercise.overridden.loadStyle"
          label="Reset"
          size="sm"
          variant="ghost"
          color="neutral"
          aria-label="Reset load style"
          data-test="reset-loadStyle"
          @click="emit('reset', 'loadStyle')"
        />
      </div>
    </div>

    <div v-if="showBarWeight" class="flex flex-col gap-1">
      <span class="text-sm font-medium text-dimmed">Bar weight</span>
      <div class="flex items-center gap-2">
        <AppNumberInput
          v-model="local.barWeight"
          :min="1"
          :step="5"
          class="min-w-0 flex-1"
          data-test="setting-bar-weight"
        />
        <UButton
          v-if="exercise.overridden.barWeight"
          label="Reset"
          size="sm"
          variant="ghost"
          color="neutral"
          aria-label="Reset bar weight"
          data-test="reset-barWeight"
          @click="emit('reset', 'barWeight')"
        />
      </div>
    </div>

    <UButton label="Save" block class="min-h-10" data-test="settings-save" @click="save" />
  </div>
</template>
