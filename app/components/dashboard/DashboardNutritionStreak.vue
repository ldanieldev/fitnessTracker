<script setup lang="ts">
import { calendarColumns } from '~~/shared/utils/dashboard'

const today = useTodayOrNow()
const { data, error, refresh } = useDashboardNutrition()
const { user } = useUserSession()
const columns = computed(() => calendarColumns(today.value, data.value?.weekStart ?? user.value?.weekStart ?? 1))
</script>

<template>
  <DashboardCard
    v-if="data !== null"
    title="Nutrition logged"
    :aside="data ? `${data.lastWeek} / 7 last week` : undefined"
    data-test="dashboard-nutrition"
  >
    <DashboardRetry v-if="error && !data" label="Couldn’t load nutrition" @retry="refresh()" />
    <template v-else-if="data">
      <div class="flex items-baseline justify-between gap-2">
        <span>
          <span class="text-2xl font-bold text-highlighted tabular-nums" data-test="nutrition-streak">
            {{ data.streak }}
          </span>
          <span class="text-xs text-muted"> day streak</span>
        </span>
        <span class="text-xs text-dimmed" data-test="nutrition-best">best {{ data.best }}</span>
      </div>
      <DashboardCalendar :columns="columns" :days="data.days" :today="today" fill="bg-amber-500" />
    </template>
    <template v-else>
      <USkeleton class="h-8 w-32" />
      <DashboardCalendar :columns="columns" :days="[]" :today="today" loading />
    </template>
  </DashboardCard>
</template>
