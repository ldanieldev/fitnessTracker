<script setup lang="ts">
const modules = useModules()
const anyModule = computed(() => modules.body.value || modules.workouts.value || modules.nutrition.value)
// The strip picks its fetches once per mount, so a module flip must remount it.
const stripKey = computed(() => [modules.body.value, modules.workouts.value, modules.nutrition.value].join())
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <AppNavbar title="Dashboard" />
    </template>

    <template #body>
      <div v-if="anyModule" class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <DashboardTodayStrip :key="stripKey" />
        <!-- DOM order is desktop order; order-* gives phone order Bodyweight, Consistency, Strength, Nutrition. -->
        <div class="grid grid-cols-1 gap-4 empty:hidden lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
          <DashboardBodyweightTrend v-if="modules.body.value" class="order-1 lg:order-none" />
          <DashboardStrength v-if="modules.workouts.value" class="order-3 lg:order-none" />
          <DashboardConsistency v-if="modules.workouts.value" class="order-2 lg:order-none" />
          <DashboardNutritionStreak v-if="modules.nutrition.value" class="order-4 lg:order-none" />
        </div>
      </div>
      <UEmpty
        v-else
        icon="i-lucide-eye-off"
        title="Every section is hidden"
        description="Turn on Body, Workouts or Nutrition in your preferences."
        :actions="[{ label: 'Open preferences', to: '/settings/profile' }]"
        data-test="dashboard-empty"
      />
    </template>
  </UDashboardPanel>
</template>
