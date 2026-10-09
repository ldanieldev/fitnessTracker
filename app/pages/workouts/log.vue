<script setup lang="ts">
import type { PointerChoice, WorkoutSession } from '~~/shared/types/workout'
import type { RoutineSummary } from '~~/shared/types/routine'
import type { SetFlow } from '~~/shared/utils/supersets'
import type { ToolsTab } from '~/components/workout/WorkoutToolsSheet.vue'
import WorkoutToolsSheet from '~/components/workout/WorkoutToolsSheet.vue'
import WorkoutCopySheet from '~/components/workout/WorkoutCopySheet.vue'
import WorkoutDayPickerSheet from '~/components/workout/WorkoutDayPickerSheet.vue'
import WorkoutProgramStatus from '~/components/workout/WorkoutProgramStatus.vue'

const toast = useToast()
const fail = useFailToast()
const wakeLock = useWakeLock()
const restTimerOpen = ref(false)
const copyOpen = ref(false)
const dayPickerOpen = ref(false)
const { start: startWorkout, starting } = useWorkoutStart()

const restTimer = useNuxtApp().$restTimer
const { defaultRestSeconds } = useWorkoutPrefs()
const lastLoggedEntryId = ref<number | null>(null)

// Completion's vibrate + toast live in the restTimer plugin so they also fire off this page.
watch(
  () => restTimer.isRunning.value,
  (running) => {
    if (!running) restTimerOpen.value = false
  }
)

const { session, status, error } = await useActiveSession()

watch(error, (value) => {
  if (value) fail('Couldn\'t load workout', value, 'Could not load your workout')
})

const loading = computed(() => status.value === 'pending' && !session.value)

const {
  data: routineList,
  status: routineStatus,
  refresh: refreshRoutines
} = useWorkoutFetch<RoutineSummary[]>(WORKOUT_KEYS.routines, '/api/workouts/routines', { lazy: true })
const routinesLoading = computed(() => routineStatus.value === 'pending' && !routineList.value)
const dueRoutine = computed(() => routineList.value?.find((routine) => routine.active && routine.nextDay) ?? null)

const { enrollment } = useEnrollment()
watch(
  () => enrollment.value?.phase?.id,
  (now, before) => {
    if (now !== before) void refreshRoutines()
  }
)

onMounted(() => {
  wakeLock.enable()
})

onBeforeUnmount(() => {
  wakeLock.disable()
})

function toggleWakeLock() {
  if (wakeLock.active.value) wakeLock.disable()
  else wakeLock.enable()
}

async function start(body: {
  routineDayId?: number
  pointer?: PointerChoice
  copyFromId?: number
  entryIds?: number[]
}) {
  const started = await startWorkout(body)
  if (started) session.value = started
  return started
}

async function startNextDay() {
  const started = await start({ routineDayId: dueRoutine.value!.nextDay!.id })
  if (!started) await refreshRoutines()
}

async function finishSession() {
  const id = session.value?.id
  if (!id) return
  try {
    session.value = await apiFetch<WorkoutSession>(`/api/workouts/sessions/${id}`, {
      method: 'PATCH',
      body: { finish: true }
    })
    // The plugin's "Rest complete!" toast would otherwise still fire after the workout has ended.
    restTimer.skip()
    toast.add({ title: 'Workout finished', color: 'success' })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail('Couldn\'t finish workout', err, 'Could not finish this workout')
  }
}

async function deleteSession() {
  const id = session.value?.id
  if (!id) return
  try {
    await apiFetch(`/api/workouts/sessions/${id}`, { method: 'DELETE' })
    session.value = null
    restTimer.skip()
    toast.add({ title: 'Workout deleted', color: 'success' })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail('Couldn\'t delete workout', err, 'Could not delete this workout')
  }
}

function onSetLogged(entryId: number, flow: SetFlow) {
  lastLoggedEntryId.value = entryId
  if (!flow.rest) return
  const entry = session.value?.entries.find((candidate) => candidate.id === flow.restFromEntryId)
  restTimer.start(entry?.restOverrideSeconds ?? entry?.restSeconds ?? defaultRestSeconds.value)
}

const toolsOpen = ref(false)
const toolsEntryId = ref<number | null>(null)
const toolsTab = ref<ToolsTab>('plates')
const toolsTarget = ref<number | null>(null)

function openTools() {
  toolsEntryId.value = lastLoggedEntryId.value
  toolsOpen.value = true
}

function openPlates(entryId: number, weight: number | null) {
  toolsEntryId.value = entryId
  toolsTab.value = 'plates'
  if (weight !== null) toolsTarget.value = weight
  toolsOpen.value = true
}

const presetWeights = reactive<Record<number, { weight: number; seq: number }>>({})
let presetSeq = 0

function useWeight(entryId: number, weight: number) {
  presetWeights[entryId] = { weight, seq: ++presetSeq }
  toolsOpen.value = false
}
</script>

<template>
  <UDashboardPanel id="workout-log">
    <template #header>
      <UDashboardNavbar :ui="{ right: 'gap-1' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #title>
          <span class="font-semibold max-sm:hidden">Current Workout</span>
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
            class="min-h-10 min-w-10 justify-center"
            data-test="wake-lock-toggle"
            @click="toggleWakeLock"
          />
          <UButton
            icon="i-lucide-calculator"
            variant="ghost"
            color="neutral"
            size="sm"
            aria-label="Workout tools"
            class="min-h-10 min-w-10 justify-center"
            data-test="tools-open"
            @click="openTools"
          />
          <UButton
            v-if="restTimer.isRunning.value"
            icon="i-lucide-timer"
            :label="restTimer.display.value"
            variant="soft"
            color="primary"
            size="sm"
            class="min-h-10 font-mono tabular-nums"
            :aria-label="`Rest timer, ${restTimer.display.value} left, open it`"
            data-test="rest-timer-pill"
            @click="restTimerOpen = true"
          />
          <UButton
            v-else
            icon="i-lucide-timer"
            variant="ghost"
            color="neutral"
            size="sm"
            aria-label="Rest timer"
            class="min-h-10 min-w-10 justify-center"
            data-test="rest-timer-open"
            @click="restTimerOpen = true"
          />
          <UButton
            v-if="session && !session.endedAt"
            icon="i-lucide-square"
            variant="soft"
            color="error"
            size="sm"
            class="min-h-10"
            data-test="session-finish"
            @click="finishSession"
          >
            <span class="sm:hidden">End</span>
            <span class="max-sm:hidden">End Workout</span>
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div
        v-if="loading || (!session && routinesLoading)"
        class="mx-auto flex w-full max-w-2xl flex-col gap-3"
        data-test="log-skeleton"
        aria-busy="true"
      >
        <USkeleton class="h-10 w-full rounded-lg" />
        <USkeleton class="h-28 w-full rounded-xl" />
        <USkeleton class="h-28 w-full rounded-xl" />
      </div>

      <div v-else-if="!session" class="mx-auto flex w-full max-w-2xl flex-col gap-3" data-test="session-start">
        <p class="text-sm text-muted">No workout in progress.</p>
        <WorkoutProgramStatus />
        <UButton
          v-if="dueRoutine"
          icon="i-lucide-play"
          block
          class="min-h-12"
          :loading="starting"
          data-test="start-routine-next"
          @click="startNextDay"
        >
          <span class="flex min-w-0 flex-col items-start">
            <span class="truncate font-semibold" data-test="start-routine-next-name">{{
              dueRoutine.nextDay!.name
            }}</span>
            <span class="truncate text-xs opacity-80">{{ dueRoutine.name }} · next</span>
          </span>
        </UButton>
        <UButton
          label="Other routine day…"
          icon="i-lucide-list"
          variant="soft"
          color="neutral"
          block
          class="min-h-10"
          :disabled="starting"
          data-test="start-routine-other"
          @click="dayPickerOpen = true"
        />
        <UButton
          label="Copy a past workout…"
          icon="i-lucide-copy"
          variant="soft"
          color="neutral"
          block
          class="min-h-10"
          :disabled="starting"
          data-test="start-copy"
          @click="copyOpen = true"
        />
        <UButton
          label="Empty workout"
          icon="i-lucide-plus"
          variant="soft"
          color="neutral"
          block
          class="min-h-10"
          :loading="starting"
          data-test="start-empty"
          @click="start({})"
        />
      </div>

      <WorkoutSessionEditor
        v-else
        v-model:session="session"
        plate-button
        :preset-weights="presetWeights"
        class="mx-auto w-full max-w-2xl pb-4"
        @set-logged="onSetLogged"
        @open-plates="openPlates"
        @delete="deleteSession"
      />

      <WorkoutCopySheet v-model:open="copyOpen" @start="start" />
      <WorkoutDayPickerSheet v-model:open="dayPickerOpen" @start="start" />

      <WorkoutRestTimer v-model:open="restTimerOpen" :timer="restTimer" />

      <WorkoutToolsSheet
        v-model:open="toolsOpen"
        v-model:entry-id="toolsEntryId"
        v-model:tab="toolsTab"
        v-model:target="toolsTarget"
        :entries="session?.entries ?? []"
        @use-weight="useWeight"
      />
    </template>
  </UDashboardPanel>
</template>
