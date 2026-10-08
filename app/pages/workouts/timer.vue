<script setup lang="ts">
const restTimer = useNuxtApp().$restTimer
</script>

<template>
  <UDashboardPanel id="workouts-timer">
    <template #header>
      <UDashboardNavbar title="Timer">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <WorkoutTimerPanel :timer="restTimer" class="mx-auto w-full max-w-md py-4" data-test="timer-page" />
    </template>
  </UDashboardPanel>
</template>
