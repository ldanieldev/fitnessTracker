<script setup lang="ts">
import { format } from 'date-fns'
import type { ChartRange } from '~~/shared/types/series'
import type { GraphMetric, WorkoutProgress } from '~~/shared/types/workout'
import { cardioMetricDisplay } from '~~/shared/utils/cardioUnits'
import { rangeStart } from '~~/shared/utils/series'
import { metricLabel, metricUnit } from '~~/shared/utils/workoutMetrics'
import { workoutGoalProgress } from '~~/shared/utils/workoutGoals'
import { totalTimeLabel } from '~~/shared/utils/workoutTime'

const range = useState<ChartRange>('workouts:range', () => 'mtd')
const custom = ref<{ from: string; to: string } | null>(null)
const today = useTodayOrNow()

const to = computed(() => custom.value?.to ?? today.value)
const from = computed(() => custom.value?.from ?? rangeStart(range.value, to.value) ?? '')
const query = computed(() => (from.value ? { from: from.value, to: to.value } : { to: to.value }))

const progressFetch = useWorkoutFetch<WorkoutProgress>(
  () => WORKOUT_KEYS.progress(custom.value ? `${from.value}:${to.value}` : range.value),
  '/api/workouts/progress',
  { query }
)
await progressFetch
const progress = computed(() => progressFetch.data.value)
const progressError = computed(() => Boolean(progressFetch.error.value))

const customSheetOpen = ref(false)
const draftFrom = ref('')
const draftTo = ref('')
// Dates are YYYY-MM-DD, so string comparison orders them correctly.
const customRangeInvalid = computed(
  () => Boolean(draftFrom.value) && Boolean(draftTo.value) && draftFrom.value > draftTo.value
)
const canApplyCustom = computed(() => Boolean(draftFrom.value && draftTo.value) && !customRangeInvalid.value)

function openCustomSheet() {
  draftFrom.value = custom.value?.from ?? ''
  draftTo.value = custom.value?.to ?? ''
  customSheetOpen.value = true
}

function applyCustom() {
  if (!canApplyCustom.value) return
  custom.value = { from: draftFrom.value, to: draftTo.value }
  customSheetOpen.value = false
}

function clearCustom() {
  custom.value = null
  customSheetOpen.value = false
}

const totalDuration = computed(() => totalTimeLabel(progress.value?.totals.durationSeconds ?? 0))

function goalDate(date: string) {
  return format(new Date(`${date}T00:00:00`), 'd MMM')
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function goalAmount(metric: GraphMetric, value: number | null) {
  if (value == null) return '—'
  const cardio = cardioMetricDisplay(metric)
  return cardio ? cardio.format(cardio.toDisplay(value)) : formatNumber(value)
}

function goalUnit(metric: GraphMetric) {
  return cardioMetricDisplay(metric)?.unit ?? metricUnit(metric)
}
</script>

<template>
  <UDashboardPanel id="workouts-progress">
    <template #header>
      <UDashboardNavbar title="Progress">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <AppRangeTabs v-if="!custom" v-model="range" class="min-w-0 sm:flex-1" />
          <UBadge
            v-else
            variant="subtle"
            color="neutral"
            class="items-center gap-1.5 self-start"
            data-test="progress-custom-chip"
          >
            {{ custom.from }} → {{ custom.to }}
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="xs"
              class="min-h-0 min-w-0 p-0.5"
              aria-label="Clear custom range"
              data-test="progress-custom-clear"
              @click="custom = null"
            />
          </UBadge>
          <UButton
            label="Custom range"
            variant="soft"
            color="neutral"
            size="sm"
            class="self-start sm:shrink-0"
            data-test="progress-custom-open"
            @click="openCustomSheet"
          />
        </div>

        <div v-if="progressError" class="flex flex-col items-start gap-2" data-test="progress-error">
          <p class="text-sm text-dimmed">Couldn't load this range.</p>
          <UButton
            v-if="custom"
            label="Clear custom range"
            variant="soft"
            color="neutral"
            size="sm"
            data-test="progress-error-clear"
            @click="custom = null"
          />
        </div>
        <template v-else>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="progress-total-workouts">
              <p class="text-xs uppercase text-muted">Workouts</p>
              <p class="text-lg font-semibold tabular-nums">{{ progress?.totals.workouts ?? 0 }}</p>
            </UCard>
            <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="progress-total-sets">
              <p class="text-xs uppercase text-muted">Sets</p>
              <p class="text-lg font-semibold tabular-nums">{{ progress?.totals.sets ?? 0 }}</p>
            </UCard>
            <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="progress-total-reps">
              <p class="text-xs uppercase text-muted">Reps</p>
              <p class="text-lg font-semibold tabular-nums">{{ progress?.totals.reps ?? 0 }}</p>
            </UCard>
            <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="progress-total-volume">
              <p class="text-xs uppercase text-muted">Volume</p>
              <p class="text-lg font-semibold tabular-nums">{{ formatNumber(progress?.totals.volume ?? 0) }} lb</p>
            </UCard>
            <UCard :ui="{ body: 'p-3 sm:p-3' }" data-test="progress-total-time">
              <p class="text-xs uppercase text-muted">Time</p>
              <p class="text-lg font-semibold tabular-nums">{{ totalDuration }}</p>
            </UCard>
          </div>

          <div class="flex flex-col gap-2">
            <h2 class="text-sm font-medium text-highlighted">Training volume</h2>
            <WorkoutMuscleBars :muscles="progress?.muscles ?? []" />
          </div>

          <div class="flex flex-col gap-2">
            <h2 class="text-sm font-medium text-highlighted">Goals</h2>
            <p v-if="(progress?.goals.length ?? 0) === 0" class="text-sm text-dimmed" data-test="progress-goals-empty">
              No goals yet — set one from an exercise's Graph tab.
            </p>
            <div v-else class="flex flex-col gap-2">
              <UCard
                v-for="goal in progress!.goals"
                :key="`${goal.exerciseId}-${goal.metric}`"
                :ui="{ body: 'p-3 sm:p-3' }"
                data-test="progress-goal"
              >
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between gap-2">
                    <NuxtLink
                      :to="`/workouts/exercises/${goal.exerciseId}`"
                      class="font-medium text-highlighted hover:underline"
                    >
                      {{ goal.exerciseName }}
                    </NuxtLink>
                    <UBadge v-if="goal.reached" label="Reached" color="success" variant="subtle" size="sm" />
                  </div>
                  <p class="text-sm text-dimmed">
                    {{ metricLabel(goal.metric, goal.lowerIsBetter ? 'assisted' : null) }}
                  </p>
                  <p class="text-sm tabular-nums" data-test="progress-goal-values">
                    {{ goalAmount(goal.metric, goal.current) }} / {{ goalAmount(goal.metric, goal.targetValue) }}
                    {{ goalUnit(goal.metric) }}
                  </p>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
                    <div
                      class="h-full rounded-full bg-primary"
                      :style="{
                        width: `${workoutGoalProgress(goal.current, goal.targetValue, goal.lowerIsBetter) * 100}%`
                      }"
                    />
                  </div>
                  <p v-if="goal.targetDate" class="text-xs text-dimmed">By {{ goalDate(goal.targetDate) }}</p>
                </div>
              </UCard>
            </div>
          </div>
        </template>
      </div>

      <AppSheet v-model:open="customSheetOpen" title="Custom range">
        <template #body>
          <div class="flex flex-col gap-3">
            <UFormField label="From">
              <UInput v-model="draftFrom" type="date" class="w-full" data-test="progress-from" />
            </UFormField>
            <UFormField label="To">
              <UInput v-model="draftTo" type="date" class="w-full" data-test="progress-to" />
            </UFormField>
            <p v-if="customRangeInvalid" class="text-sm text-error" data-test="progress-custom-error">
              The start date must come before the end date
            </p>
            <div class="flex gap-2">
              <UButton
                v-if="custom"
                label="Clear"
                variant="soft"
                color="neutral"
                data-test="progress-custom-sheet-clear"
                @click="clearCustom"
              />
              <UButton
                label="Apply"
                class="ml-auto"
                :disabled="!canApplyCustom"
                data-test="progress-custom-apply"
                @click="applyCustom"
              />
            </div>
          </div>
        </template>
      </AppSheet>
    </template>
  </UDashboardPanel>
</template>
