<script setup lang="ts">
import { format } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkoutSessionSummary } from '~~/shared/types/workout'
import { durationLabel } from '~~/shared/utils/workoutTime'
import WorkoutCopySheet from '~/components/workout/WorkoutCopySheet.vue'
import { errorMessage } from '~/utils/apiError'

const PAGE_SIZE = 20
// sessionListQuerySchema caps limit at 1000, so paging stops there instead of asking for a page the route rejects.
const MAX_LIMIT = 1000

const toast = useToast()
const pages = ref(1)
const limit = computed(() => Math.min(pages.value * PAGE_SIZE, MAX_LIMIT))

const { data: sessions, status } = useWorkoutFetch<WorkoutSessionSummary[]>(
  () => sessionListKey(limit.value),
  () => `/api/workouts/sessions?limit=${limit.value}`
)

// Nuxt carries the previous key's rows into a new key while it loads, so track which limit produced what is shown.
const shownLimit = ref(PAGE_SIZE)
watch([status, limit], ([value]) => {
  if (value === 'success') shownLimit.value = limit.value
}, { immediate: true })

const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const loadingMore = computed(() => loading.value && shownLimit.value < limit.value)
const refreshing = computed(() => loading.value && !loadingMore.value && Boolean(sessions.value))
const hasMore = computed(() => (sessions.value?.length ?? 0) === shownLimit.value && shownLimit.value < MAX_LIMIT)

function loadMore() {
  if (hasMore.value && !loading.value) pages.value++
}

const sentinel = ref<HTMLElement | null>(null)
const sentinelVisible = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver((entries) => {
    sentinelVisible.value = entries.some((entry) => entry.isIntersecting)
  }, { rootMargin: '200px' })
  if (sentinel.value) observer.observe(sentinel.value)
})
watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous)
  if (element) observer?.observe(element)
  if (!element) sentinelVisible.value = false
})
onBeforeUnmount(() => observer?.disconnect())
// The observer fires only on visibility changes, so a sentinel still in view after a page lands pulls the next.
watch([sentinelVisible, loading], () => {
  if (sentinelVisible.value) loadMore()
})

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function summaryLine(summary: WorkoutSessionSummary) {
  const when = format(new Date(`${summary.performedOn}T00:00:00`), 'EEE, MMM d')
  const parts = [when, plural(summary.exerciseCount, 'exercise'), plural(summary.setCount, 'set')]
  if (summary.endedAt) parts.push(durationLabel(summary.startedAt, new Date(summary.endedAt).getTime()))
  return parts.join(' · ')
}

function fail(err: unknown, fallback: string) {
  toast.add({ title: 'Update failed', description: errorMessage(err, fallback), color: 'error' })
}

const copySourceId = ref<number | null>(null)
const copyOpen = ref(false)
const { start: startWorkout, starting } = useWorkoutStart()

function copySession(id: number) {
  copySourceId.value = id
  copyOpen.value = true
}

async function startCopy(body: { copyFromId: number, entryIds: number[] }) {
  if (await startWorkout(body)) await navigateTo('/workouts/log')
}

const timesOpen = ref(false)
const deleteOpen = ref(false)
const targetId = ref<number | null>(null)
const timesTarget = ref<WorkoutSessionSummary | null>(null)

function openTimes(summary: WorkoutSessionSummary) {
  timesTarget.value = summary
  timesOpen.value = true
}

function openDelete(summary: WorkoutSessionSummary) {
  targetId.value = summary.id
  deleteOpen.value = true
}

async function saveTimes(times: { startedAt: string, endedAt: string | null, performedOn: string }) {
  const id = timesTarget.value?.id
  if (!id) return
  try {
    await apiFetch(`/api/workouts/sessions/${id}`, { method: 'PATCH', body: times })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail(err, 'Could not change the date and time')
  }
}

async function confirmDelete() {
  const id = targetId.value
  deleteOpen.value = false
  if (!id) return
  try {
    await apiFetch(`/api/workouts/sessions/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Workout deleted', color: 'success' })
    // Naming the keys skips the deleted session's own key, which would 404 now that the row is gone.
    await invalidateWorkouts(WORKOUT_KEYS.sessions, WORKOUT_KEYS.active)
  } catch (err: unknown) {
    fail(err, 'Could not delete this workout')
  }
}

// Nuxt UI renders menu items through pickLinkProps, so a data-test on the item is dropped; the label slot carries it.
function menuFor(summary: WorkoutSessionSummary): DropdownMenuItem[][] {
  return [
    [{
      label: 'Change date & time',
      icon: 'i-lucide-calendar-clock',
      testId: `session-times-${summary.id}`,
      onSelect: () => openTimes(summary)
    }],
    [{
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error',
      testId: `session-delete-${summary.id}`,
      onSelect: () => openDelete(summary)
    }]
  ]
}
</script>

<template>
  <UDashboardPanel id="workout-sessions">
    <template #header>
      <UDashboardNavbar title="Workout History">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
        <div v-if="!sessions" class="flex flex-col gap-2" data-test="session-list-skeleton" aria-busy="true">
          <USkeleton v-for="i in 8" :key="i" class="h-14 rounded-xl" />
        </div>
        <div v-else class="relative">
          <UProgress v-if="refreshing" size="xs" class="absolute inset-x-0 -top-2" data-test="session-list-loading" />
          <div
            class="flex flex-col gap-2 transition-opacity"
            :class="refreshing ? 'pointer-events-none opacity-50' : ''"
            :aria-busy="refreshing"
            data-test="session-list"
          >
            <div
              v-for="summary in sessions"
              :key="summary.id"
              class="flex items-center gap-1 rounded-xl bg-elevated px-2 py-1"
              data-test="session-row"
            >
              <NuxtLink
                :to="`/workouts/sessions/${summary.id}`"
                class="flex min-h-10 min-w-0 flex-1 flex-col justify-center py-1"
                :data-test="`session-link-${summary.id}`"
              >
                <span class="truncate font-medium text-highlighted">{{ summary.name ?? 'Workout' }}</span>
                <span class="truncate text-xs text-dimmed">{{ summaryLine(summary) }}</span>
              </NuxtLink>
              <UButton
                icon="i-lucide-copy"
                variant="ghost"
                color="neutral"
                class="min-h-10 min-w-10 justify-center"
                aria-label="Copy into a new workout"
                :disabled="starting"
                :data-test="`session-copy-${summary.id}`"
                @click="copySession(summary.id)"
              />
              <UDropdownMenu :items="menuFor(summary)">
                <UButton
                  icon="i-lucide-ellipsis-vertical"
                  variant="ghost"
                  color="neutral"
                  class="min-h-10 min-w-10 justify-center"
                  aria-label="Workout options"
                  :data-test="`session-menu-${summary.id}`"
                />
                <template #item-label="{ item }">
                  <span :data-test="item.testId">{{ item.label }}</span>
                </template>
              </UDropdownMenu>
            </div>
          </div>
          <p v-if="!loading && sessions.length === 0" class="text-sm text-dimmed">No workouts logged yet</p>
          <div v-if="hasMore" ref="sentinel" class="flex justify-center py-3" data-test="session-list-end">
            <UIcon v-if="loadingMore" name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
            <UButton
              v-else
              label="Show more"
              variant="soft"
              color="neutral"
              class="min-h-10"
              data-test="session-load-more"
              @click="loadMore"
            />
          </div>
        </div>
      </div>

      <WorkoutCopySheet v-model:open="copyOpen" :source-id="copySourceId" @start="startCopy" />

      <WorkoutSessionTimesSheet
        v-if="timesTarget"
        v-model:open="timesOpen"
        :started-at="timesTarget.startedAt"
        :ended-at="timesTarget.endedAt"
        @save="saveTimes"
      />

      <AppSheet v-model:open="deleteOpen" title="Delete workout">
        <template #body>
          <div class="flex flex-col gap-3" data-test="session-delete">
            <p class="text-sm text-muted">This removes the workout and every set logged in it.</p>
            <UButton label="Delete" color="error" block class="min-h-10" data-test="session-delete-confirm" @click="confirmDelete" />
          </div>
        </template>
      </AppSheet>
    </template>
  </UDashboardPanel>
</template>
