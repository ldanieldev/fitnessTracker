<script setup lang="ts">
const route = useRoute()
const id = computed(() => Number(route.params.id))
</script>

<template>
  <NutritionSavedMealEditor :key="id" :saved-meal-id="id" />
</template>
