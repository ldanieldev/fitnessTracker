<script setup lang="ts">
defineProps<{ text: string }>()
const open = defineModel<boolean>('open', { default: false })

function selectAll(event: FocusEvent) {
  ;(event.target as HTMLTextAreaElement).select()
}
</script>

<template>
  <AppSheet v-model:open="open" title="Share workout" description="Select the text and copy it.">
    <template #body>
      <UTextarea
        :model-value="text"
        readonly
        autofocus
        :rows="12"
        class="w-full"
        :ui="{ base: 'font-mono text-xs' }"
        data-test="share-text"
        @focus="selectAll"
      />
    </template>
  </AppSheet>
</template>
