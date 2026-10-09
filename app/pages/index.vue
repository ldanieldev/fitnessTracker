<script setup lang="ts">
import { sub } from 'date-fns'
import type { Period, Range } from '~/types'

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date()
})
const period = ref<Period>('daily')
const modules = useModules()
const anyModule = computed(() => modules.body.value || modules.workouts.value || modules.nutrition.value)
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Dashboard" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right> </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <DashboardDateRangePicker v-model="range" class="-ms-1" />

          <DashboardPeriodSelect v-model="period" :range="range" />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <DashboardToday v-if="modules.nutrition.value" class="mb-4" />
      <DashboardProgram v-if="modules.workouts.value" class="mb-4" />
      <DashboardBodyMetric v-if="modules.body.value" class="mb-4" />
      <DashboardWorkoutStats
        v-if="modules.workouts.value"
        :period="period"
        :range="range"
        data-test="dashboard-workout-stats"
      />
      <UEmpty
        v-if="!anyModule"
        icon="i-lucide-eye-off"
        title="Every section is hidden"
        description="Turn on Body, Workouts or Nutrition in your preferences."
        :actions="[{ label: 'Open preferences', to: '/settings/profile' }]"
        data-test="dashboard-empty"
      />
    </template>
  </UDashboardPanel>
</template>
