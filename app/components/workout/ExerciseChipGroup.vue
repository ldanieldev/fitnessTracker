<script setup lang="ts">
defineProps<{
  legend: string
  items: { key: string; name: string }[]
  selected: string[]
  testPrefix: string
  isDisabled?: (key: string) => boolean
}>()
const emit = defineEmits<{ toggle: [key: string] }>()
</script>

<template>
  <fieldset class="min-w-0">
    <legend class="mb-1 text-sm font-medium text-dimmed">{{ legend }}</legend>
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="item in items"
        :key="item.key"
        :label="item.name"
        class="min-h-10"
        :color="selected.includes(item.key) ? 'primary' : 'neutral'"
        :variant="selected.includes(item.key) ? 'solid' : 'soft'"
        :aria-pressed="selected.includes(item.key)"
        :disabled="isDisabled?.(item.key) ?? false"
        :data-test="`${testPrefix}-${item.key}`"
        @click="emit('toggle', item.key)"
      />
    </div>
  </fieldset>
</template>
