<script setup lang="ts">
defineProps<{ title: string; aside?: string }>()
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="text-sm font-bold tracking-wide text-highlighted uppercase">{{ title }}</h2>
        <span v-if="aside" class="text-xs text-dimmed" data-test="card-aside">{{ aside }}</span>
      </div>
      <slot />
    </div>
  </UCard>
</template>
