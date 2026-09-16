<script setup lang="ts">
const { metrics, fetch } = useBodyOverview()
await fetch
const range = useBodyRange()
</script>

<template>
  <UDashboardPanel id="body-progress">
    <template #header>
      <UDashboardNavbar title="Progress">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <BodyRangeTabs v-model="range" />
        <BodyProgressCard v-for="metric in metrics" :key="metric.type.id" :metric="metric" :range="range" />
        <p v-if="metrics.length === 0" class="text-sm text-dimmed" data-test="progress-empty">Every measurement is hidden</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
