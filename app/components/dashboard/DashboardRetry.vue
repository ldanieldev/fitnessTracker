<script setup lang="ts">
defineProps<{ label: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex items-center justify-between gap-2 text-sm text-muted" data-test="dashboard-retry">
    {{ label }}
    <UButton label="Retry" size="sm" variant="subtle" color="neutral" @click="$emit('retry')" />
  </div>
</template>
