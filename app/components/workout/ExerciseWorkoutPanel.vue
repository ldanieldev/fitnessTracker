<script setup lang="ts">
import type { Exercise } from '~~/shared/types/workout'
import { normalizePlateSizes } from '~~/shared/utils/plates'
import WorkoutPlateSizesPicker from '~/components/workout/WorkoutPlateSizesPicker.vue'

const LABEL_UI = { label: 'text-dimmed' }

const props = defineProps<{ exercise: Exercise }>()
const emit = defineEmits<{ save: [patch: Record<string, unknown>]; reset: [field: string] }>()

const { plateSizes: defaultPlates } = useWorkoutPrefs()

interface LocalSettings {
  weightIncrement: number | null
  restSeconds: number | null
  plateSizes: number[] | null
}

const local = reactive<LocalSettings>({
  weightIncrement: props.exercise.weightIncrement,
  restSeconds: props.exercise.restSeconds,
  plateSizes: props.exercise.plateSizes ? [...props.exercise.plateSizes] : null
})

watch(
  () => props.exercise,
  (exercise) => {
    local.weightIncrement = exercise.weightIncrement
    local.restSeconds = exercise.restSeconds
    local.plateSizes = exercise.plateSizes ? [...exercise.plateSizes] : null
  }
)

function samePlates(a: number[] | null, b: number[] | null) {
  return a === b || (a !== null && b !== null && a.length === b.length && a.every((size, i) => size === b[i]))
}

function save() {
  const patch: Record<string, unknown> = {}
  if (local.weightIncrement !== props.exercise.weightIncrement) patch.weightIncrement = local.weightIncrement
  if (local.restSeconds !== props.exercise.restSeconds) patch.restSeconds = local.restSeconds
  if (!samePlates(local.plateSizes, props.exercise.plateSizes)) patch.plateSizes = local.plateSizes
  if (Object.keys(patch).length === 0) return
  emit('save', patch)
}

function resetPlates() {
  if (props.exercise.plateSizes === null) local.plateSizes = null
  else emit('reset', 'plateSizes')
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-dimmed" data-test="workout-help">
      These apply to this exercise only and override your defaults in
      <NuxtLink to="/settings/workout" class="underline">Settings → Workout</NuxtLink>. Leave a field empty to use the
      default.
    </p>

    <UFormField label="Weight increment" :ui="LABEL_UI">
      <div class="flex items-center gap-2">
        <AppNumberInput
          v-model="local.weightIncrement"
          :min="0.5"
          :step="2.5"
          class="min-w-0 flex-1"
          data-test="setting-weight-increment"
        />
        <UButton
          v-if="exercise.weightIncrement !== null"
          label="Reset"
          size="sm"
          variant="ghost"
          color="neutral"
          aria-label="Reset weight increment"
          data-test="reset-weightIncrement"
          @click="emit('reset', 'weightIncrement')"
        />
      </div>
    </UFormField>

    <UFormField label="Rest (seconds)" :ui="LABEL_UI">
      <div class="flex items-center gap-2">
        <AppNumberInput
          v-model="local.restSeconds"
          :min="5"
          :step="15"
          class="min-w-0 flex-1"
          data-test="setting-rest-seconds"
        />
        <UButton
          v-if="exercise.restSeconds !== null"
          label="Reset"
          size="sm"
          variant="ghost"
          color="neutral"
          aria-label="Reset rest time"
          data-test="reset-restSeconds"
          @click="emit('reset', 'restSeconds')"
        />
      </div>
    </UFormField>

    <fieldset v-if="exercise.loadStyle === 'barbell'" class="flex min-w-0 flex-col gap-1" data-test="setting-plates">
      <legend class="mb-1 text-sm font-medium text-dimmed">Plates</legend>
      <div v-if="local.plateSizes === null" class="flex items-center gap-2">
        <span class="min-w-0 flex-1 text-sm">Default ({{ defaultPlates.join(' · ') }})</span>
        <UButton
          label="Customise"
          size="sm"
          variant="soft"
          color="neutral"
          class="min-h-10"
          data-test="plates-customise"
          @click="local.plateSizes = [...defaultPlates]"
        />
      </div>
      <template v-else>
        <WorkoutPlateSizesPicker
          :model-value="local.plateSizes"
          :choices="defaultPlates"
          @update:model-value="(sizes) => (local.plateSizes = normalizePlateSizes(sizes))"
        />
        <UButton
          label="Use default plates"
          size="sm"
          variant="ghost"
          color="neutral"
          class="min-h-10 self-start"
          data-test="reset-plateSizes"
          @click="resetPlates"
        />
      </template>
    </fieldset>

    <UButton label="Save" block class="min-h-10" data-test="workout-save" @click="save" />
  </div>
</template>
