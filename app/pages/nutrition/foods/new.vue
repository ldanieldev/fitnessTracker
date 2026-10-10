<script setup lang="ts">
const backOrTo = useBackOrTo()

async function onCreated() {
  await backOrTo('/nutrition/foods')
}
</script>

<template>
  <UDashboardPanel id="nutrition-food-new">
    <template #header>
      <AppNavbar title="New food" back="/nutrition/foods" />
    </template>
    <template #body>
      <div class="max-w-3xl mx-auto w-full">
        <NutritionFoodForm @created="onCreated" />
      </div>
    </template>
  </UDashboardPanel>
</template>
