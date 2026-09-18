<script setup lang="ts">
import { MOCK_EXERCISES } from '~/constants/workout'
import type { WorkoutExercise } from '~/types/workout'

const session = useWorkoutSession()
const restTimerOpen = ref(false)
const restTimerRef = ref<{ restart: () => void }>()
const wakeLock = useWakeLock()

// Cast readonly exercises to mutable for child component props
const exercises = computed(() => session.exercises.value as unknown as WorkoutExercise[])

onMounted(() => {
  session.loadMockData()
  wakeLock.enable()
})

onBeforeUnmount(() => {
  wakeLock.disable()
})

function toggleWakeLock() {
  if (wakeLock.active.value) {
    wakeLock.disable()
  } else {
    wakeLock.enable()
  }
}

// Add exercise search
const selectedExerciseId = ref<number | undefined>(undefined)
const availableExercises = computed(() => {
  const addedIds = new Set(session.exercises.value.map((e) => e.id))
  return MOCK_EXERCISES.filter((e) => !addedIds.has(e.id)).map((e) => ({ label: e.name, value: e.id }))
})

function onAddExercise(value: number | undefined) {
  if (!value) return
  const exercise = MOCK_EXERCISES.find((e) => e.id === value)
  if (!exercise) return
  session.addExercise({ id: exercise.id, name: exercise.name, type: exercise.type })
  nextTick(() => {
    selectedExerciseId.value = undefined
  })
}

function handleShowHistory(_exerciseId: number) {
  // TODO: open history modal/slideover with previous instances of this exercise
}

function handleLogSet(index: number, data: { weight: number; reps: number; rpe: number }) {
  session.logSet(index, data)
  restTimerOpen.value = true
  nextTick(() => {
    restTimerRef.value?.restart()
  })
}
</script>

<template>
  <div>
    <UDashboardPanel id="workout-log">
      <template #header>
        <UDashboardNavbar :ui="{ right: 'gap-3' }">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>

          <template #title>
            <span class="font-semibold">Current Workout</span>
          </template>

          <template #right>
            <UButton
              v-if="wakeLock.isSupported.value"
              :icon="wakeLock.active.value ? 'i-lucide-sun' : 'i-lucide-sun-dim'"
              :color="wakeLock.active.value ? 'primary' : 'neutral'"
              :aria-label="wakeLock.active.value ? 'Screen staying awake' : 'Keep screen awake'"
              :aria-pressed="wakeLock.active.value"
              variant="ghost"
              size="sm"
              data-test="wake-lock-toggle"
              @click="toggleWakeLock"
            />
            <UButton icon="i-lucide-timer" variant="ghost" color="neutral" size="sm" @click="restTimerOpen = true" />
            <UButton
              label="End Workout"
              variant="soft"
              color="error"
              size="sm"
              icon="i-lucide-square"
              @click="navigateTo('/')"
            />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="flex flex-col gap-4 max-w-4xl mx-auto w-full pb-4">
          <!-- Exercise cards -->
          <WorkoutExerciseCard
            v-for="(exercise, index) in exercises"
            :key="exercise.id"
            :exercise="exercise"
            :index="index"
            @toggle-collapse="session.toggleCollapse"
            @remove="session.removeExercise"
            @show-history="handleShowHistory"
            @log-set="handleLogSet"
            @delete-set="session.deleteSet"
            @update-set="session.updateSet"
            @update-set-note="session.updateSetNote"
            @log-cardio="session.logCardio"
          />

          <!-- Add exercise -->
          <UInputMenu
            v-model="selectedExerciseId"
            :items="availableExercises"
            placeholder="Search exercises to add..."
            icon="i-lucide-plus"
            value-key="value"
            class="w-full"
            @update:model-value="onAddExercise"
          />
        </div>
      </template>
    </UDashboardPanel>

    <!-- Rest timer drawer -->
    <WorkoutRestTimer ref="restTimerRef" v-model:open="restTimerOpen" />
  </div>
</template>
