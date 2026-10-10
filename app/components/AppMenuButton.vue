<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

defineProps<{ items: DropdownMenuItem[] | DropdownMenuItem[][]; label: string; testId?: string }>()
</script>

<template>
  <UDropdownMenu :items="items">
    <UButton
      icon="i-lucide-ellipsis-vertical"
      variant="ghost"
      color="neutral"
      class="min-h-10 min-w-10 justify-center"
      :aria-label="label"
      :data-test="testId"
    />
    <template #item-label="{ item }">
      <span :data-test="item.testId">{{ item.label }}</span>
    </template>
  </UDropdownMenu>
</template>
