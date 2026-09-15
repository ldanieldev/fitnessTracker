<script setup lang="ts">
import { todayDate } from '~~/shared/utils/nutritionSummary'

onMounted(() => {
  navigateTo(`/diary/${todayDate()}`, { replace: true })
})
</script>

<template>
  <UDashboardPanel id="diary">
    <template #body>
      <NutritionListSkeleton />
    </template>
  </UDashboardPanel>
</template>
