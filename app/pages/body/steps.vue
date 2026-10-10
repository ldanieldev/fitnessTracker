<script setup lang="ts">
import { format } from 'date-fns'
import type { StepTarget, StepWeek } from '~~/shared/types/steps'
import { STEP_WEEKS_MAX, formatSteps, formatStepsCompact, stepCounts } from '~~/shared/utils/steps'

const TREND_WEEKS = 26
const count = ref(TREND_WEEKS)
const today = useTodayOrNow()
const weeksFetch = useBodyFetch<StepWeek[]>(() => BODY_KEYS.stepWeeks(count.value), '/api/body/steps/weeks', {
  query: computed(() => ({ count: count.value, to: today.value }))
})
const targetFetch = useBodyFetch<{ target: StepTarget | null }>(BODY_KEYS.stepTarget, '/api/body/steps/target', {
  query: computed(() => ({ to: today.value }))
})
await Promise.all([weeksFetch, targetFetch])

const weeks = computed(() => weeksFetch.data.value ?? [])
const current = computed(() => weeks.value[0] ?? null)
const past = computed(() => weeks.value.slice(1))
const target = computed(() => targetFetch.data.value?.target ?? null)
const canLoadMore = computed(
  () => weeksFetch.status.value === 'pending' || (weeks.value.length === count.value && count.value < STEP_WEEKS_MAX)
)
const known = computed(() => stepCounts(weeks.value))
const lastWeekTotal = computed(() => (past.value[0]?.logged ? past.value[0].total : null))
const bestDay = computed(() => {
  const counts = (current.value?.days ?? []).flatMap((d) => (d.steps === null ? [] : [d.steps]))
  return counts.length ? Math.max(...counts) : null
})

const trendWeeks = computed(() => weeks.value.slice(0, TREND_WEEKS).reverse())
const points = computed(() =>
  trendWeeks.value.flatMap((w) => (w.average === null ? [] : [{ date: w.start, value: w.average }]))
)
const summary = computed(() =>
  points.value.length
    ? `Weekly average steps, latest ${formatSteps(points.value[points.value.length - 1]!.value)}/day`
    : 'No steps logged yet'
)

const logDate = ref<string | null>(null)
const logOpen = ref(false)
const targetOpen = ref(false)

function pick(date: string) {
  logDate.value = date
  logOpen.value = true
}
</script>

<template>
  <UDashboardPanel id="body-steps">
    <template #header>
      <UDashboardNavbar title="Steps">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Log" size="sm" data-test="steps-log" @click="pick(today)" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div v-if="current" class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <BodyStepsHero :week="current" @log="pick(today)" @set-target="targetOpen = true" />
        <UCard>
          <BodyStepsWeekChart :week="current" :today="today" :last-week-total="lastWeekTotal" @pick="pick" />
        </UCard>
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="flex flex-col rounded-2xl bg-elevated p-3 text-left ring-1 ring-accented
              transition-colors hover:bg-accented focus-visible:outline-2 focus-visible:outline-primary"
            data-test="tile-target"
            @click="targetOpen = true"
          >
            <span class="text-xs uppercase tracking-wide text-muted">Target</span>
            <span class="text-base font-semibold tabular-nums text-highlighted">
              {{ target ? formatSteps(target.dailyTarget) : '—' }}
            </span>
            <span class="text-xs font-medium text-primary">{{ target ? 'Change' : 'Set' }}</span>
          </button>
          <div class="flex flex-col rounded-2xl bg-elevated p-3" data-test="tile-avg">
            <span class="text-xs uppercase tracking-wide text-muted">Avg/day</span>
            <span class="text-base font-semibold tabular-nums text-highlighted">
              {{ formatSteps(current.average) }}
            </span>
          </div>
          <div class="flex flex-col rounded-2xl bg-elevated p-3" data-test="tile-best">
            <span class="text-xs uppercase tracking-wide text-muted">Best</span>
            <span class="text-base font-semibold tabular-nums text-highlighted">{{ formatSteps(bestDay) }}</span>
          </div>
        </div>
        <UCard>
          <template #header>
            <h2 class="font-medium">Trend</h2>
          </template>
          <AppLineChart
            :points="points"
            :trend="[]"
            :goal="target?.dailyTarget ?? null"
            :goal-label="target ? `${formatSteps(target.dailyTarget)}/day` : ''"
            :from="trendWeeks[0]?.start ?? current.start"
            :to="current.start"
            :gap-days="7"
            :summary="summary"
            empty-text="No steps logged yet"
            zero-based
            :format-tick="formatStepsCompact"
          >
            <template #tooltip="{ dot }">
              <div class="text-dimmed">Week of {{ format(new Date(`${dot.date}T00:00:00`), 'MMM d') }}</div>
              <div class="font-medium tabular-nums">{{ formatSteps(dot.value) }}/day</div>
            </template>
          </AppLineChart>
        </UCard>
        <UCard v-if="past.length">
          <template #header>
            <h2 class="font-medium">Past weeks</h2>
          </template>
          <BodyStepsHistory :weeks="past" />
          <UButton
            v-if="canLoadMore"
            label="Load more"
            variant="subtle"
            color="neutral"
            block
            class="mt-2 min-h-10"
            :loading="weeksFetch.status.value === 'pending'"
            data-test="steps-load-more"
            @click="count += TREND_WEEKS"
          />
        </UCard>
      </div>
      <BodyStepsSheet v-model:open="logOpen" :date="logDate" :known="known" />
      <BodyStepsTargetSheet v-model:open="targetOpen" :target="target" />
    </template>
  </UDashboardPanel>
</template>
