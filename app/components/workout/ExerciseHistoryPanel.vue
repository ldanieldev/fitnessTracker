<script setup lang="ts">
import { format } from 'date-fns'
import type { ExerciseHistorySession, HistorySessionTotals, SetRecord, SetRecordKind } from '~~/shared/types/workout'

const props = defineProps<{ exerciseId: number }>()

const RECORD_LABEL: Record<SetRecordKind, string> = {
  weight_reps: 'Record: weight × reps',
  reps: 'Record: reps',
  distance: 'Record: distance',
  pace: 'Record: pace'
}

function recordLabel(records: SetRecord[]) {
  return records.map((record) => RECORD_LABEL[record.kind]).join(', ')
}

const PAGE_SIZE = 10
const MAX_LIMIT = 200
const pages = ref(1)
const limit = computed(() => Math.min(pages.value * PAGE_SIZE, MAX_LIMIT))

const { data: sessions, status } = useWorkoutFetch<ExerciseHistorySession[]>(
  () => WORKOUT_KEYS.history(props.exerciseId, limit.value),
  () => `/api/workouts/exercises/${props.exerciseId}/history?limit=${limit.value}`
)

// Nuxt carries the previous key's rows into a new key while it loads, so track which limit produced what is shown.
const shownLimit = ref(PAGE_SIZE)
watch(
  [status, limit],
  ([value]) => {
    if (value === 'success') shownLimit.value = limit.value
  },
  { immediate: true }
)

const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const loadingMore = computed(() => loading.value && shownLimit.value < limit.value)
const hasMore = computed(() => (sessions.value?.length ?? 0) === shownLimit.value && shownLimit.value < MAX_LIMIT)

function loadMore() {
  if (hasMore.value && !loading.value) pages.value++
}

const sentinel = ref<HTMLElement | null>(null)
const sentinelVisible = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries.some((entry) => entry.isIntersecting)
    },
    { rootMargin: '200px' }
  )
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

function sessionDate(performedOn: string) {
  return format(new Date(`${performedOn}T00:00:00`), 'EEE d MMM yyyy')
}

function volumeLabel(totals: HistorySessionTotals) {
  return totals.volume != null ? `${totals.volume} lb` : '—'
}

function topLabel(totals: HistorySessionTotals) {
  return totals.topWeight != null && totals.topWeightReps != null
    ? `top ${totals.topWeight} lb × ${totals.topWeightReps}`
    : '—'
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="!sessions" class="flex flex-col gap-2" data-test="history-skeleton" aria-busy="true">
      <USkeleton v-for="i in 4" :key="i" class="h-24 rounded-xl" />
    </div>
    <template v-else>
      <p v-if="sessions.length === 0" class="text-sm text-dimmed">No sessions logged yet</p>
      <div
        v-for="session in sessions"
        :key="session.sessionId"
        class="flex flex-col gap-2 rounded-xl bg-elevated px-3 py-2"
        data-test="history-session"
      >
        <NuxtLink
          :to="`/workouts/sessions/${session.sessionId}`"
          class="flex min-h-10 flex-col justify-center"
          :data-test="`history-session-${session.sessionId}`"
        >
          <span class="text-sm font-medium text-highlighted">{{ sessionDate(session.performedOn) }}</span>
          <span v-if="session.name" class="text-xs text-dimmed">{{ session.name }}</span>
        </NuxtLink>

        <div class="flex flex-col gap-1">
          <div
            v-for="set in session.sets"
            :key="set.id"
            class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"
            data-test="history-set"
          >
            <span class="font-medium">{{ formatSet(measuresFor(session.trackingType), set) }}</span>
            <span v-if="set.comment" class="text-xs text-dimmed">{{ set.comment }}</span>
            <UIcon
              v-if="set.records.length > 0"
              name="i-lucide-trophy"
              class="size-5 text-warning"
              :aria-label="recordLabel(set.records)"
              data-test="history-record"
            />
          </div>
        </div>

        <div class="text-xs text-dimmed" data-test="history-totals">
          {{ session.totals.sets }} sets · {{ volumeLabel(session.totals) }} · {{ topLabel(session.totals) }}
        </div>
      </div>

      <div v-if="hasMore" ref="sentinel" class="flex justify-center py-3" data-test="history-list-end">
        <UIcon v-if="loadingMore" name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
        <UButton
          v-else
          label="Show more"
          variant="soft"
          color="neutral"
          class="min-h-10"
          data-test="history-load-more"
          @click="loadMore"
        />
      </div>
    </template>
  </div>
</template>
