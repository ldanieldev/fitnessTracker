<script setup lang="ts">
const { targets, totals, goalName, dayFetch, trackedFetch, profilesFetch } = useTodaySummary()
await Promise.all([dayFetch, trackedFetch, profilesFetch])
</script>

<template>
  <NuxtLink to="/diary/today" class="block" data-test="dashboard-today">
    <NutritionSummaryCard :targets="targets" :totals="totals" :goal-name="goalName" :interactive="false" />
  </NuxtLink>
</template>
