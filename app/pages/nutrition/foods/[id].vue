<script setup lang="ts">
const route = useRoute()
const foodId = computed(() => Number(route.params.id))
</script>

<template>
  <NutritionFoodEditor :key="foodId" :food-id="foodId" />
</template>
