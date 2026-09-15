<script setup lang="ts">
withDefaults(defineProps<{ rows?: number }>(), { rows: 3 })
</script>

<template>
  <div class="flex flex-col gap-2" data-test="list-skeleton">
    <USkeleton v-for="i in rows" :key="i" class="h-14 rounded-lg" />
  </div>
</template>
