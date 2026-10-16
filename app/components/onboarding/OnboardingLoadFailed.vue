<script setup lang="ts">
defineProps<{ message: string; testId: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <p class="text-sm text-error">{{ message }}</p>
    <UButton label="Retry" color="neutral" variant="outline" size="sm" :data-test="testId" @click="$emit('retry')" />
  </div>
</template>
