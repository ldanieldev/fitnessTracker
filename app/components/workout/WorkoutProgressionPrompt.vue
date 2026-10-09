<script setup lang="ts">
import type { ProgressionCopy } from '~~/shared/utils/workoutProgression'

defineProps<{ copy: ProgressionCopy | null; kind: 'add' | 'drop' }>()
const content: Record<string, string> = { 'data-test': 'progression-prompt' }
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ choose: ['apply' | 'stay'] }>()

function choose(choice: 'apply' | 'stay') {
  open.value = false
  emit('choose', choice)
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="copy?.title ?? ''"
    :ui="{ footer: 'flex-col items-stretch gap-2' }"
    :content="content"
  >
    <template #body>
      <p v-if="copy" class="text-sm" data-test="progression-prompt-text">
        {{ copy.bodyParts.before }}<span class="whitespace-nowrap">{{ copy.bodyParts.range }}</span
        >{{ copy.bodyParts.after }}
      </p>
    </template>
    <template #footer>
      <UButton
        :label="copy?.apply"
        :color="kind === 'add' ? 'primary' : 'warning'"
        block
        class="min-h-10"
        data-test="progression-prompt-apply"
        @click="choose('apply')"
      />
      <UButton
        :label="copy?.stay"
        variant="soft"
        color="neutral"
        block
        class="min-h-10"
        data-test="progression-prompt-stay"
        @click="choose('stay')"
      />
    </template>
  </UModal>
</template>
