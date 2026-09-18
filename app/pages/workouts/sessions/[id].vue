<script setup lang="ts">
import type { WorkoutSession } from '~~/shared/types/workout'
import { errorMessage } from '~/utils/apiError'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const toast = useToast()

const sessionFetch = useWorkoutFetch<WorkoutSession>(
  () => WORKOUT_KEYS.session(id.value),
  () => `/api/workouts/sessions/${id.value}`,
  { lazy: true }
)
const { data: session, error } = sessionFetch
// Awaiting only on the server keeps the SSR 404 while client navigation opens the page at once with a skeleton.
if (import.meta.server) {
  await sessionFetch
  if (error.value) throw createError({ statusCode: 404, statusMessage: 'Workout not found', fatal: true })
}
watch(error, (value) => {
  if (value) showError({ statusCode: 404, statusMessage: 'Workout not found' })
})

async function deleteSession() {
  try {
    await apiFetch(`/api/workouts/sessions/${id.value}`, { method: 'DELETE' })
    toast.add({ title: 'Workout deleted', color: 'success' })
    // Naming the keys skips this session's own key, which would 404 now that the row is gone.
    await invalidateWorkouts(WORKOUT_KEYS.sessions, WORKOUT_KEYS.active)
    await navigateTo('/workouts/sessions')
  } catch (err: unknown) {
    toast.add({ title: 'Update failed', description: errorMessage(err, 'Could not delete this workout'), color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="workout-session">
    <template #header>
      <UDashboardNavbar title="Workout">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
        <div v-if="!session" class="flex flex-col gap-3" data-test="session-skeleton" aria-busy="true">
          <USkeleton class="h-10 w-full rounded-lg" />
          <USkeleton class="h-28 w-full rounded-xl" />
          <USkeleton class="h-28 w-full rounded-xl" />
        </div>

        <template v-else>
          <UButton
            v-if="!session.endedAt"
            label="This workout is still open — continue logging"
            icon="i-lucide-play"
            to="/workouts/log"
            variant="soft"
            color="neutral"
            block
            class="min-h-10"
            data-test="session-continue"
          />
          <WorkoutSessionEditor v-model:session="session" @delete="deleteSession" />
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
