<script setup lang="ts">
import type { WorkoutExercise, DistanceUnit } from '~/types/workout'
import { DISTANCE_UNITS } from '~/constants/workout'

const props = defineProps<{
  exercise: WorkoutExercise
  index: number
}>()

const emit = defineEmits<{
  toggleCollapse: [index: number]
  remove: [index: number]
  showHistory: [exerciseId: number]
  logSet: [index: number, data: { weight: number; reps: number; rpe: number }]
  deleteSet: [exerciseIndex: number, setIndex: number]
  updateSet: [exerciseIndex: number, setIndex: number, data: { weight: number; reps: number; rpe: number }]
  updateSetNote: [exerciseIndex: number, setIndex: number, note: string]
  logCardio: [
    index: number,
    data: { durationMinutes: number; distance: number; distanceUnit: DistanceUnit; calories: number }
  ]
}>()

// Active set input state — defaults from last set if available
const lastSet = props.exercise.sets.at(-1)
const weight = ref(lastSet?.weight ?? 135)
const reps = ref(lastSet?.reps ?? 5)
const rpe = ref(5)

const totalVolume = computed(() => {
  return props.exercise.sets.reduce((sum, set) => sum + set.weight * set.reps, 0)
})

const confirmRemoveOpen = ref(false)

function handleRemove() {
  confirmRemoveOpen.value = false
  emit('remove', props.index)
}

// Cardio input state
const durationMinutes = ref<number | undefined>(undefined)
const distance = ref<number | undefined>(undefined)
const distanceUnit = ref<DistanceUnit>('km')
const calories = ref<number | undefined>(undefined)

function handleLogSet() {
  emit('logSet', props.index, { weight: weight.value, reps: reps.value, rpe: rpe.value })
}

function handleLogCardio() {
  emit('logCardio', props.index, {
    durationMinutes: durationMinutes.value ?? 0,
    distance: distance.value ?? 0,
    distanceUnit: distanceUnit.value,
    calories: calories.value ?? 0
  })
}
</script>

<template>
  <UCard :ui="exercise.collapsed ? { body: 'hidden' } : {}">
    <template #header>
      <div class="flex items-center justify-between gap-1">
        <button class="flex items-center gap-2 flex-1 text-left min-h-10 py-1" @click="emit('toggleCollapse', index)">
          <UIcon
            :name="exercise.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
            class="text-dimmed shrink-0"
          />
          <span class="font-semibold">{{ exercise.name }}</span>
          <UBadge
            v-if="exercise.type === 'strength' && exercise.sets.length > 0"
            :label="`${exercise.sets.length} sets`"
            variant="subtle"
            size="sm"
          />
          <UBadge
            v-if="exercise.type === 'cardio' && exercise.cardioLog.logged"
            label="Logged"
            variant="subtle"
            color="success"
            size="sm"
          />
        </button>
        <UButton
          icon="i-lucide-history"
          variant="ghost"
          color="neutral"
          size="sm"
          class="shrink-0"
          @click="emit('showHistory', exercise.id)"
        />
        <UButton
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="sm"
          class="shrink-0"
          @click="confirmRemoveOpen = true"
        />
      </div>
    </template>

    <div v-if="!exercise.collapsed">
      <!-- Strength exercise -->
      <template v-if="exercise.type === 'strength'">
        <!-- Completed sets -->
        <div v-if="exercise.sets.length > 0" class="flex flex-col gap-2 mb-4">
          <WorkoutSetRow
            v-for="(set, setIdx) in exercise.sets"
            :key="set.setNumber"
            :set="set"
            @delete="emit('deleteSet', index, setIdx)"
            @update:set="emit('updateSet', index, setIdx, $event)"
            @update:note="emit('updateSetNote', index, setIdx, $event)"
          />
          <div class="flex justify-end px-3 pt-1">
            <span class="text-xs text-dimmed font-medium">Total Volume: {{ totalVolume.toLocaleString() }} lbs</span>
          </div>
        </div>

        <!-- Active set input -->
        <div class="flex flex-col gap-4">
          <USeparator v-if="exercise.sets.length > 0" />

          <p class="text-sm text-dimmed font-medium">Set {{ exercise.sets.length + 1 }}</p>

          <!-- Plate calculator -->
          <WorkoutPlateCalculator v-model="weight" />

          <!-- Reps -->
          <div class="flex flex-col items-center gap-1">
            <span class="text-sm text-dimmed">Reps</span>
            <UInputNumber v-model="reps" :min="1" :step="1" size="xl" class="w-32" />
          </div>

          <!-- RPE -->
          <WorkoutRpeSlider v-model="rpe" />

          <!-- Log button -->
          <UButton label="Log Set" block size="lg" @click="handleLogSet" />
        </div>
      </template>

      <!-- Cardio exercise -->
      <template v-if="exercise.type === 'cardio'">
        <div v-if="exercise.cardioLog.logged" class="flex flex-col gap-2 p-3 rounded-lg bg-elevated/50">
          <div class="flex justify-between text-sm">
            <span class="text-dimmed">Duration</span>
            <span class="font-medium">{{ exercise.cardioLog.durationMinutes }} min</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-dimmed">Distance</span>
            <span class="font-medium">{{ exercise.cardioLog.distance }} {{ exercise.cardioLog.distanceUnit }}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-dimmed">Calories</span>
            <span class="font-medium">{{ exercise.cardioLog.calories }} cal</span>
          </div>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div class="grid grid-cols-3 gap-3">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-dimmed">Duration (min)</span>
              <UInputNumber v-model="durationMinutes" :min="0" :step="1" placeholder="0" />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-dimmed">Distance</span>
              <div class="flex gap-1">
                <UInputNumber
                  v-model="distance"
                  :min="0"
                  :step="distanceUnit === 'm' ? 100 : 0.1"
                  placeholder="0"
                  class="flex-1"
                />
                <USelect v-model="distanceUnit" :items="DISTANCE_UNITS" value-key="value" class="w-18" />
              </div>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-dimmed">Calories</span>
              <UInputNumber v-model="calories" :min="0" :step="10" placeholder="0" />
            </div>
          </div>

          <UButton label="Log Cardio" block size="lg" @click="handleLogCardio" />
        </div>
      </template>
    </div>
    <UModal
      v-model:open="confirmRemoveOpen"
      :title="`Remove ${exercise.name}?`"
      description="This will remove the exercise and all logged sets."
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="confirmRemoveOpen = false" />
        <UButton label="Remove" color="error" @click="handleRemove" />
      </template>
    </UModal>
  </UCard>
</template>
