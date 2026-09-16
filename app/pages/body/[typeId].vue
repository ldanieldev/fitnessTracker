<script setup lang="ts">
import type { MeasurementEntry } from '~~/shared/types/body'
import { actualPace, dayIndex, effectiveDirection, formatDelta, formatValue, goalProgress, onTrack, requiredPace } from '~~/shared/utils/bodyMetrics'

const route = useRoute()
const typeId = computed(() => Number(route.params.typeId))
const range = useBodyRange()

const { series, trend, from, to, fetch: seriesFetch } = useBodySeries(typeId, range)
const entriesQuery = computed(() => (from.value ? { from: from.value, to: to.value } : { to: to.value }))
const entriesFetch = useBodyFetch<MeasurementEntry[]>(
  () => BODY_KEYS.entriesRange(typeId.value, from.value, to.value),
  () => `/api/body/types/${typeId.value}/entries`,
  { query: entriesQuery }
)
await Promise.all([seriesFetch, entriesFetch])
if (seriesFetch.error.value) throw createError({ statusCode: 404, statusMessage: 'Measurement type not found', fatal: true })

const type = computed(() => series.value?.type ?? null)
const editing = ref<MeasurementEntry | null>(null)
const sheetOpen = ref(false)

const goal = computed(() => series.value?.goal ?? null)
const latestValue = computed(() => series.value?.latest?.value ?? null)
const direction = computed(() => (type.value ? effectiveDirection(type.value, goal.value) : 'neutral'))

const lastWeek = computed(() => {
  const last = trend.value[trend.value.length - 1]
  if (!last) return null
  const earlier = [...trend.value].reverse().find((p) => dayIndex(p.date) <= dayIndex(last.date) - 7)
  return earlier ? last.value - earlier.value : null
})
const pace = computed(() => actualPace(trend.value))
const needed = computed(() => (goal.value ? requiredPace(goal.value, latestValue.value, to.value) : null))
const track = computed(() => onTrack(needed.value, pace.value))
const progress = computed(() => (goal.value ? goalProgress(goal.value, latestValue.value) : null))

const goalOpen = ref(false)

function openNew() {
  editing.value = null
  sheetOpen.value = true
}

function openEdit(entry: MeasurementEntry) {
  editing.value = entry
  sheetOpen.value = true
}
</script>

<template>
  <UDashboardPanel :id="`body-${typeId}`">
    <template #header>
      <UDashboardNavbar :title="type?.name ?? 'Measurement'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Log" size="sm" data-test="detail-log" @click="openNew" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div v-if="series && type" class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <BodyRangeTabs v-model="range" />
        <div class="grid grid-cols-3 gap-2">
          <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="tile-last-week">
            <p class="text-xs uppercase text-muted">Last week</p>
            <p class="text-lg font-semibold tabular-nums">{{ formatDelta(lastWeek, type.precision) }}</p>
          </UCard>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="tile-pace">
            <p class="text-xs uppercase text-muted">Avg. pace</p>
            <p class="text-lg font-semibold tabular-nums">{{ pace === null ? '—' : `${formatDelta(pace, type.precision)}/wk` }}</p>
            <UBadge v-if="track !== null" :color="track ? 'success' : 'error'" variant="subtle" size="sm">{{ track ? 'On track' : 'Behind' }}</UBadge>
          </UCard>
          <button type="button" class="text-left" data-test="tile-goal" @click="goalOpen = true">
            <UCard :ui="{ body: 'p-3 sm:p-3' }" class="h-full active:bg-accented">
              <p class="text-xs uppercase text-muted">Goal</p>
              <template v-if="goal && progress">
                <p class="text-lg font-semibold tabular-nums">{{ formatValue(goal.targetValue, type.precision) }}</p>
                <p class="text-xs text-dimmed">{{ progress.reached ? 'Reached' : progress.remaining === null ? '—' : `${formatValue(Math.abs(progress.remaining), type.precision)} ${type.unit} to go` }}</p>
              </template>
              <p v-else class="text-sm text-dimmed">Set a goal</p>
            </UCard>
          </button>
        </div>
        <UCard>
          <BodyMetricChart
            :points="series.points"
            :trend="trend"
            :goal="series.goal?.targetValue ?? null"
            :from="series.from"
            :to="series.to"
            :precision="type.precision"
            :unit="type.unit"
            :granularity="series.granularity"
          />
        </UCard>
        <BodyEntryList :entries="entriesFetch.data.value ?? []" :type="type" :direction="direction" @edit="openEdit" />
      </div>
      <BodyEntrySheet v-model:open="sheetOpen" :type="type" :entry="editing" />
      <BodyGoalSheet v-model:open="goalOpen" :type="type" :goal="goal" :latest="latestValue" />
    </template>
  </UDashboardPanel>
</template>
