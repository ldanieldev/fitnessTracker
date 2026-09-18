<script setup lang="ts">
import { format } from 'date-fns'
import type { WorkoutSession, WorkoutSessionSummary } from '~~/shared/types/workout'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { errorMessage } from '~/utils/apiError'

const toast = useToast()
const wakeLock = useWakeLock()
const restTimerOpen = ref(false)
const restTimerRef = ref<{ restart: () => void }>()
const copyOpen = ref(false)
const starting = ref(false)

const sessionFetch = useWorkoutFetch<WorkoutSession | null>(
  WORKOUT_KEYS.active,
  '/api/workouts/sessions/active',
  // No open session answers 204, which reaches useFetch as undefined; null keeps it in the payload so the client doesn't refetch.
  { lazy: true, transform: (session: WorkoutSession | null) => session ?? null }
)
const { data: session, status, error } = sessionFetch
// Awaiting only on the server keeps client navigation instant while SSR paints the same markup hydration expects.
if (import.meta.server) await sessionFetch

watch(error, (value) => {
  if (value) toast.add({ title: 'Load failed', description: errorMessage(value, 'Could not load your workout'), color: 'error' })
})

const loading = computed(() => status.value === 'pending' && !session.value)

const { data: recent, execute: loadRecent } = useWorkoutFetch<WorkoutSessionSummary[]>(
  sessionListKey(10),
  '/api/workouts/sessions?limit=10',
  { immediate: false }
)
const recentSessions = computed(() => recent.value ?? [])

watch(copyOpen, (open) => {
  if (open) loadRecent()
})

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

function fail(err: unknown, fallback: string) {
  toast.add({ title: 'Update failed', description: errorMessage(err, fallback), color: 'error' })
}

function openSessionFrom(err: unknown): WorkoutSession | null {
  return (err as { data?: { data?: { session?: WorkoutSession | null } } }).data?.data?.session ?? null
}

async function start(body: { copyFromId?: number }) {
  if (starting.value) return
  starting.value = true
  copyOpen.value = false
  try {
    // The server default would date the session by UTC, which is tomorrow for an evening workout west of Greenwich.
    const started = { ...body, performedOn: todayDate() }
    session.value = await apiFetch<WorkoutSession>('/api/workouts/sessions', { method: 'POST', body: started })
    await invalidateWorkouts()
  } catch (err: unknown) {
    // A 409 means another tab already opened one; adopt it instead of stranding the page on the start screen.
    const open = openSessionFrom(err)
    if (open) session.value = open
    else fail(err, 'Could not start this workout')
  } finally {
    starting.value = false
  }
}

async function finishSession() {
  const id = session.value?.id
  if (!id) return
  try {
    session.value = await apiFetch<WorkoutSession>(`/api/workouts/sessions/${id}`, { method: 'PATCH', body: { finish: true } })
    toast.add({ title: 'Workout finished', color: 'success' })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail(err, 'Could not finish this workout')
  }
}

async function deleteSession() {
  const id = session.value?.id
  if (!id) return
  try {
    await apiFetch(`/api/workouts/sessions/${id}`, { method: 'DELETE' })
    session.value = null
    toast.add({ title: 'Workout deleted', color: 'success' })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail(err, 'Could not delete this workout')
  }
}

function onSetLogged() {
  restTimerOpen.value = true
  restTimerRef.value?.restart()
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function recentLine(summary: WorkoutSessionSummary) {
  const when = format(new Date(`${summary.performedOn}T00:00:00`), 'EEE, MMM d')
  return `${when} · ${plural(summary.exerciseCount, 'exercise')} · ${plural(summary.setCount, 'set')}`
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
          <span class="font-semibold">Workout</span>
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
            label="Finish"
            variant="soft"
            color="primary"
            size="sm"
            class="min-h-10"
            data-test="session-finish"
            @click="finishSession"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="loading" class="mx-auto flex w-full max-w-2xl flex-col gap-3" data-test="log-skeleton" aria-busy="true">
        <USkeleton class="h-10 w-full rounded-lg" />
        <USkeleton class="h-28 w-full rounded-xl" />
        <USkeleton class="h-28 w-full rounded-xl" />
      </div>

      <div v-else-if="!session" class="mx-auto flex w-full max-w-2xl flex-col gap-3" data-test="session-start">
        <p class="text-sm text-muted">No workout in progress.</p>
        <UButton
          label="Start empty workout"
          icon="i-lucide-plus"
          block
          class="min-h-10"
          :loading="starting"
          data-test="start-empty"
          @click="start({})"
        />
        <UButton
          label="Copy a past workout"
          icon="i-lucide-copy"
          variant="soft"
          color="neutral"
          block
          class="min-h-10"
          :disabled="starting"
          data-test="start-copy"
          @click="copyOpen = true"
        />
      </div>

      <WorkoutSessionEditor
        v-else
        v-model:session="session"
        class="mx-auto w-full max-w-2xl pb-4"
        @set-logged="onSetLogged"
        @delete="deleteSession"
      />

      <AppSheet v-model:open="copyOpen" title="Copy a past workout">
        <template #body>
          <div class="flex flex-col gap-1" data-test="copy-list">
            <p v-if="!recentSessions.length" class="text-sm text-dimmed">No past workouts yet</p>
            <button
              v-for="summary in recentSessions"
              :key="summary.id"
              type="button"
              class="flex min-h-10 flex-col rounded-lg px-2 py-2 text-left hover:bg-elevated"
              :data-test="`copy-session-${summary.id}`"
              @click="start({ copyFromId: summary.id })"
            >
              <span class="truncate font-medium text-highlighted">{{ summary.name ?? 'Workout' }}</span>
              <span class="truncate text-xs text-dimmed">{{ recentLine(summary) }}</span>
            </button>
          </div>
        </template>
      </AppSheet>

      <WorkoutRestTimer ref="restTimerRef" v-model:open="restTimerOpen" />
    </template>
  </UDashboardPanel>
</template>
