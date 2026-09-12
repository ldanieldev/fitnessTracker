<script setup lang="ts">
const backOrTo = useBackOrTo()

async function onCreated() {
  await backOrTo('/nutrition/foods')
}
</script>

<template>
  <UDashboardPanel id="nutrition-food-new">
    <template #header>
      <UDashboardNavbar title="New food">
        <template #leading>
          <UDashboardSidebarCollapse />
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
