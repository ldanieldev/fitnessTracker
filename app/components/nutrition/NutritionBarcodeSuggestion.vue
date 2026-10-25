<script setup lang="ts">
defineProps<{ value: string; field: 'name' | 'brand' }>()
defineEmits<{ use: [] }>()
</script>

<template>
  <p class="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-dimmed" :data-test="`barcode-suggestion-${field}`">
    <span>Barcode says: {{ value }} &middot;</span>
    <UButton
      :label="`Use this ${field}`"
      size="xs"
      variant="link"
      class="cursor-pointer p-0 text-xs"
      @click="$emit('use')"
    />
  </p>
</template>
