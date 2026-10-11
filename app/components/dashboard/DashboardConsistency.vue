<script setup lang="ts">
import { calendarColumns } from '~~/shared/utils/dashboard'

const today = useTodayOrNow()
const { data, error, refresh } = useDashboardConsistency()

const { user } = useUserSession()
const columns = computed(() => calendarColumns(today.value, data.value?.weekStart ?? user.value?.weekStart ?? 1))
const aside = computed(() => {
  const week = data.value?.thisWeek
  if (!week) return undefined
  return week.target === 0 ? 'Rest week' : `${week.count} / ${week.target} this week`
})
const targetLine = computed(() => {
  const d = data.value
  if (!d) return ''
  if (d.thisWeek.target === 0) return `best ${d.best} · program rest week`
  return `best ${d.best} · target ${d.thisWeek.target}/wk (${d.targetSource})`
})
</script>

<template>
  <DashboardCard v-if="data !== null" title="Consistency" :aside="aside" data-test="dashboard-consistency">
    <DashboardRetry v-if="error && !data" label="Couldn’t load consistency" @retry="refresh()" />
    <template v-else-if="data">
      <div class="flex items-baseline justify-between gap-2">
        <span>
          <span class="text-2xl font-bold text-highlighted tabular-nums" data-test="consistency-streak">
            {{ data.streak }}
          </span>
          <span class="text-xs text-muted"> week streak</span>
        </span>
        <span class="text-xs text-dimmed" data-test="consistency-target">{{ targetLine }}</span>
      </div>
      <DashboardCalendar
        :columns="columns"
        :days="data.days"
        :today="today"
        fill="bg-red-500"
        :week-bars="data.weeks.map((w) => w.met)"
      />
    </template>
    <template v-else>
      <USkeleton class="h-8 w-32" />
      <DashboardCalendar :columns="columns" :days="[]" :today="today" :week-bars="[]" loading />
    </template>
  </DashboardCard>
</template>
