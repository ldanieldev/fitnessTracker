<script setup lang="ts">
import type { PointerChoice } from '~~/shared/types/workout'

defineProps<{ dayName: string; dueName: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ choose: [choice: PointerChoice] }>()

function choose(choice: PointerChoice) {
  open.value = false
  emit('choose', choice)
}
</script>

<template>
  <UModal v-model:open="open" title="Start out of order?" :ui="{ footer: 'flex-col items-stretch gap-2' }">
    <template #body>
      <p class="text-sm" data-test="pointer-prompt-text">You're starting {{ dayName }} but {{ dueName }} is next.</p>
    </template>
    <template #footer>
      <UButton :label="`Skip ${dueName}`" block class="min-h-10" data-test="pointer-skip" @click="choose('skip')" />
      <UButton
        :label="`Keep ${dueName} next`"
        variant="soft"
        color="neutral"
        block
        class="min-h-10"
        data-test="pointer-keep"
        @click="choose('keep')"
      />
      <UButton
        label="Cancel"
        variant="ghost"
        color="neutral"
        block
        class="min-h-10"
        data-test="pointer-cancel"
        @click="open = false"
      />
    </template>
  </UModal>
</template>
