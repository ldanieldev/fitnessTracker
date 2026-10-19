<script setup lang="ts">
import { format } from 'date-fns'
import { deltaTone, effectiveDirection, formatValue, goalProgress } from '~~/shared/utils/bodyMetrics'
import { BODYWEIGHT_DAILY_DAYS } from '~~/shared/utils/dashboard'

const TONE_CLASS = { success: 'text-success', error: 'text-error', neutral: 'text-dimmed' }
const SLIDES = [
  { key: 'daily', aside: 'Latest', range: `${BODYWEIGHT_DAILY_DAYS} days` },
  { key: 'average', aside: 'Weekly avg', range: '12 weeks' }
] as const

const { data, error, refresh } = useDashboardBodyweight()
const { metrics, fetch: overview } = useBodyOverview()
const today = useTodayOrNow()

// A weigh-in logged from the Today strip updates the overview; the trend follows it.
const latestSignature = computed(() => {
  const latest = metrics.value.find((m) => m.type.key === 'bodyweight')?.latest
  return latest ? `${latest.id}:${latest.value}:${latest.measuredOn}` : 'none'
})
let seen: string | null = null
watch(
  () => (overview.data.value === undefined ? null : latestSignature.value),
  (now) => {
    if (now === null) return
    if (seen === null) {
      seen = now
    } else if (now !== seen) {
      seen = now
      void refresh()
    }
  },
  { immediate: true }
)

const slides = computed(() => (data.value?.current == null ? SLIDES.slice(0, 1) : SLIDES))
const active = ref(0)
const slide = computed(() => slides.value[active.value] ?? slides.value[0]!)

const direction = computed(() => {
  const d = data.value
  return d ? effectiveDirection({ direction: d.direction }, d.goal) : 'neutral'
})
const arrow = (delta: number) => (delta < 0 ? '↓ ' : delta > 0 ? '↑ ' : '')
const dayLabel = (date: string) => format(new Date(`${date}T00:00:00`), 'MMM d')

const dailyChange = computed(() => {
  const d = data.value
  return d?.latest && d.previous ? d.latest.value - d.previous.value : null
})
const dailyTone = computed(() => deltaTone(dailyChange.value, direction.value))
const dailyText = computed(() => {
  const d = data.value
  if (!d?.previous || dailyChange.value === null) return null
  const since = d.previous.date === today.value ? 'earlier today' : dayLabel(d.previous.date)
  return `${arrow(dailyChange.value)}${Math.abs(dailyChange.value).toFixed(d.precision)} ${d.unit} · since ${since}`
})

const weekLabel = computed(() => {
  const week = data.value?.week
  if (!week) return null
  if (week.from.slice(0, 7) !== week.to.slice(0, 7)) return `${dayLabel(week.from)} – ${dayLabel(week.to)}`
  return `${dayLabel(week.from)}–${format(new Date(`${week.to}T00:00:00`), 'd')}`
})

const averageTone = computed(() => deltaTone(data.value?.change ?? null, direction.value))
const averageText = computed(() => {
  const d = data.value
  if (!d || d.change === null) return null
  return `${arrow(d.change)}${Math.abs(d.change).toFixed(d.precision)} ${d.unit} · 4 wks`
})

const shown = computed(() => data.value?.current ?? data.value?.latest?.value ?? null)
const goalText = computed(() => {
  const d = data.value
  if (!d?.goal || shown.value === null) return null
  if (goalProgress(d.goal, shown.value).reached) return 'Goal reached'
  const target = formatValue(d.goal.targetValue, d.precision)
  return `Goal ${target} · ${formatValue(Math.abs(d.goal.targetValue - shown.value), d.precision)} ${d.unit} to go`
})
const sparkShown = computed(() => {
  const d = data.value
  return !!d && (slide.value.key === 'daily' ? d.daily : d.series).length >= 2
})
</script>

<template>
  <DashboardCard
    v-if="data !== null"
    title="Bodyweight"
    :aside="data?.latest ? slide.aside : undefined"
    data-test="dashboard-bodyweight"
  >
    <DashboardRetry v-if="error && !data" label="Couldn’t load bodyweight" @retry="refresh()" />
    <template v-else-if="data">
      <p v-if="!data.latest" class="text-sm text-dimmed">Log a few weigh-ins to see a trend</p>
      <template v-else>
        <UCarousel
          v-slot="{ item }"
          :items="[...slides]"
          :dots="slides.length > 1"
          :ui="{
            dots: 'static mt-2 gap-2',
            dot: 'size-2 bg-(--ui-text-dimmed)/40 not-data-[state=active]:hover:bg-(--ui-text-muted)'
          }"
          data-test="bodyweight-slides"
          @select="(index: number) => (active = index)"
        >
          <div v-if="item.key === 'daily'" class="flex flex-col gap-3" data-test="bodyweight-slide-daily">
            <div class="flex items-baseline justify-between gap-2">
              <span>
                <span class="text-2xl font-bold text-highlighted tabular-nums" data-test="bodyweight-latest">
                  {{ formatValue(data.latest.value, data.precision) }}
                </span>
                <span class="text-xs text-muted"> {{ data.unit }}</span>
                <span class="text-xs text-dimmed">
                  · {{ data.latest.date === today ? 'Today' : dayLabel(data.latest.date) }}
                </span>
              </span>
              <span
                v-if="dailyText"
                class="text-xs font-semibold"
                :class="TONE_CLASS[dailyTone]"
                data-test="bodyweight-daily-change"
              >
                {{ dailyText }}
              </span>
            </div>
            <DashboardSparkline
              v-if="data.daily.length >= 2"
              :values="data.daily"
              :goal="data.goal?.targetValue"
              :tone="dailyTone"
            />
            <p v-else class="text-sm text-dimmed">Log a few weigh-ins to see a trend</p>
          </div>
          <div v-else class="flex flex-col gap-3" data-test="bodyweight-slide-average">
            <div class="flex items-baseline justify-between gap-2">
              <div>
                <span class="text-2xl font-bold text-highlighted tabular-nums" data-test="bodyweight-current">
                  {{ formatValue(data.current, data.precision) }}
                </span>
                <span class="text-xs text-muted"> {{ data.unit }}</span>
                <p v-if="weekLabel" class="text-xs text-dimmed" data-test="bodyweight-week">{{ weekLabel }}</p>
              </div>
              <span
                v-if="averageText"
                class="text-xs font-semibold"
                :class="TONE_CLASS[averageTone]"
                data-test="bodyweight-change"
              >
                {{ averageText }}
              </span>
            </div>
            <DashboardSparkline
              v-if="data.series.length >= 2"
              :values="data.series"
              :goal="data.goal?.targetValue"
              :tone="averageTone"
            />
            <p v-else class="text-sm text-dimmed">Log a few weigh-ins to see a trend</p>
          </div>
        </UCarousel>
        <div v-if="sparkShown || goalText" class="flex justify-between text-xs text-dimmed">
          <span>{{ sparkShown ? slide.range : '' }}</span>
          <span v-if="goalText" data-test="bodyweight-goal">{{ goalText }}</span>
        </div>
      </template>
    </template>
    <USkeleton v-else class="h-26 w-full" />
  </DashboardCard>
</template>
