<script setup lang="ts">
const route = useRoute()
const date = computed(() => String(route.params.date))

async function onCreated() {
  await navigateTo(`/diary/${date.value}/add`)
}
</script>

<template>
  <UDashboardPanel id="diary-new-food">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #title>
          <span class="font-semibold">New food</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto w-full">
        <NutritionFoodForm @created="onCreated" />
      </div>
    </template>
  </UDashboardPanel>
</template>
