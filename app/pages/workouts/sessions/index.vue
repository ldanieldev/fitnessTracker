<script setup lang="ts">
import type { SessionFilter, WorkoutSessionSummary } from '~~/shared/types/workout'
import WorkoutCopySheet from '~/components/workout/WorkoutCopySheet.vue'
import { errorMessage } from '~/utils/apiError'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { activeFilterCount, filterFromRoute, filterToRoute, sessionFilterParams } from '~~/shared/utils/sessionFilter'
import { monthRange } from '~~/shared/utils/workoutCalendar'

const PAGE_SIZE = 20
// sessionListQuerySchema caps limit at 1000, so paging stops there instead of asking for a page the route rejects.
const MAX_LIMIT = 1000

const toast = useToast()
const route = useRoute()
const router = useRouter()
const today = useToday()
const filterOpen = ref(false)
const exportOpen = ref(false)

const view = computed<'month' | 'list'>(() => (route.query.view === 'list' ? 'list' : 'month'))
const filter = computed(() => filterFromRoute(route.query))
const filterQuery = computed(() => sessionFilterParams(filter.value))
const filterCount = computed(() => activeFilterCount(filter.value))
const month = computed(() => {
  const raw = route.query.month
  return typeof raw === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : (today.value ?? todayDate()).slice(0, 7)
})
const day = computed(() => {
  const raw = route.query.day
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
})

let pendingQuery: Record<string, string | undefined> | null = null

// Same-tick patches merge on one microtask because route.query is stale until the replace lands; replace, not push, keeps Back clean.
function setQuery(patch: Record<string, string | undefined>) {
  if (!pendingQuery) {
    pendingQuery = {}
    queueMicrotask(() => {
      const merged = { ...route.query, ...pendingQuery }
      pendingQuery = null
      const next: Record<string, string> = {}
      for (const [key, value] of Object.entries(merged)) {
        if (typeof value === 'string' && value !== '') next[key] = value
      }
      void router.replace({ query: next })
    })
  }
  Object.assign(pendingQuery, patch)
}

function changeMonth(value: string) {
  const current = pendingQuery && 'day' in pendingQuery ? pendingQuery.day : day.value
  setQuery({ month: value, day: current?.startsWith(value) ? current : undefined })
}

function applyFilter(next: SessionFilter) {
  const cleared = { cat: undefined, match: undefined, ex: undefined, w: undefined, r: undefined }
  setQuery({ ...cleared, ...filterToRoute(next) })
}

const pages = ref(1)
const limit = computed(() => Math.min(pages.value * PAGE_SIZE, MAX_LIMIT))

const { data: sessions, status, error: listError, execute: executeList } = useWorkoutFetch<WorkoutSessionSummary[]>(
  () => sessionListKey(limit.value, filterQuery.value),
  () => `/api/workouts/sessions?limit=${limit.value}${filterQuery.value ? `&${filterQuery.value}` : ''}`,
  { enabled: () => view.value === 'list' }
)
watch(filterQuery, () => {
  pages.value = 1
})

const range = computed(() => monthRange(month.value))
const { data: monthSessions, status: monthStatus, error: monthError, execute: executeMonth } = useWorkoutFetch<WorkoutSessionSummary[]>(
  () => sessionMonthKey(range.value.from, range.value.to, filterQuery.value),
  () => `/api/workouts/sessions?limit=1000&from=${range.value.from}&to=${range.value.to}${filterQuery.value ? `&${filterQuery.value}` : ''}`,
  { enabled: () => view.value === 'month' }
)

// A disabled fetch skips key changes and invalidations, so the view that just appeared refetches to catch up.
watch(view, (value) => {
  void (value === 'list' ? executeList() : executeMonth())
})

const selectedDay = computed(() => {
  if (day.value) return day.value
  const now = today.value ?? todayDate()
  return now.startsWith(month.value) ? now : null
})
const dayRows = computed(() => (monthSessions.value ?? []).filter((s) => s.performedOn === selectedDay.value))

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

function fail(err: unknown, fallback: string) {
  toast.add({ title: 'Update failed', description: errorMessage(err, fallback), color: 'error' })
}

watch(listError, (err) => {
  if (err) fail(err, 'Could not load workouts')
})
watch(monthError, (err) => {
  if (err) fail(err, 'Could not load workouts')
})

const copySourceId = ref<number | null>(null)
const copyOpen = ref(false)
const { start: startWorkout, starting } = useWorkoutStart()
const { manualOpen, manualText, shareById } = useWorkoutShare()

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
</script>

<template>
  <UDashboardPanel id="workout-sessions">
    <template #header>
      <UDashboardNavbar title="Workout History">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UDropdownMenu :items="[[{ label: 'Export CSV', icon: 'i-lucide-download', testId: 'history-export-open', onSelect: () => { exportOpen = true } }]]">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              variant="ghost"
              color="neutral"
              class="min-h-10 min-w-10 justify-center"
              aria-label="History options"
              data-test="history-menu"
            />
            <template #item-label="{ item }">
              <span :data-test="item.testId">{{ item.label }}</span>
            </template>
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
        <div class="flex items-center gap-2">
          <div class="flex flex-1 rounded-lg bg-elevated p-1">
            <UButton label="Month" :variant="view === 'month' ? 'solid' : 'ghost'" color="neutral" class="min-h-10 flex-1 justify-center" data-test="history-view-month" @click="setQuery({ view: undefined })" />
            <UButton label="List" :variant="view === 'list' ? 'solid' : 'ghost'" color="neutral" class="min-h-10 flex-1 justify-center" data-test="history-view-list" @click="setQuery({ view: 'list' })" />
          </div>
          <UChip :show="filterCount > 0" :text="filterCount" size="3xl">
            <UButton icon="i-lucide-funnel" variant="ghost" color="neutral" class="min-h-10 min-w-10 justify-center" aria-label="Filter workouts" data-test="history-filter-open" @click="filterOpen = true" />
            <template #content>
              <span data-test="history-filter-count">{{ filterCount }}</span>
            </template>
          </UChip>
        </div>
        <div v-if="filterCount > 0">
          <UBadge color="primary" variant="soft" class="min-h-8 gap-1" data-test="history-filter-chip">
            Filtered
            <UButton icon="i-lucide-x" size="xs" variant="link" color="primary" class="min-h-10 min-w-10 justify-center" aria-label="Clear filter" data-test="history-filter-chip-clear" @click="applyFilter({})" />
          </UBadge>
        </div>

        <template v-if="view === 'month'">
          <WorkoutCalendarMonth
            :sessions="monthSessions ?? []"
            :month="month"
            :day="selectedDay"
            @update:month="changeMonth"
            @update:day="(value) => setQuery({ day: value ?? undefined })"
          />
          <div v-if="selectedDay" class="flex flex-col gap-2" data-test="history-day-rows">
            <WorkoutSessionRow
              v-for="summary in dayRows"
              :key="summary.id"
              :summary="summary"
              :copy-disabled="starting"
              @copy="copySession"
              @share="shareById"
              @times="openTimes"
              @delete="openDelete"
            />
            <p v-if="monthStatus === 'success' && !dayRows.length" class="text-sm text-dimmed" data-test="history-day-empty">No workouts</p>
          </div>
        </template>
        <template v-else>
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
              <WorkoutSessionRow
                v-for="summary in sessions"
                :key="summary.id"
                :summary="summary"
                :copy-disabled="starting"
                @copy="copySession"
                @share="shareById"
                @times="openTimes"
                @delete="openDelete"
              />
            </div>
            <p v-if="!loading && sessions.length === 0" class="text-sm text-dimmed">{{ filterCount > 0 ? 'No workouts match this filter' : 'No workouts logged yet' }}</p>
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
        </template>
      </div>

      <WorkoutHistoryFilterSheet v-model:open="filterOpen" :filter="filter" @apply="applyFilter" />
      <WorkoutExportSheet v-model:open="exportOpen" :filter="filter" />
      <WorkoutShareSheet v-model:open="manualOpen" :text="manualText" />
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
