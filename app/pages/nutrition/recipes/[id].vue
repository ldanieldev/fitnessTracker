<script setup lang="ts">
const route = useRoute()
const recipeId = computed(() => Number(route.params.id))
</script>

<template>
  <NutritionRecipeEditor :key="recipeId" :recipe-id="recipeId" />
</template>
