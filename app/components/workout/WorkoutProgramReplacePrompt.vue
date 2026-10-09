<script setup lang="ts">
defineProps<{ running: string, next: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UModal v-model:open="open" :title="`End ${clipName(running)}?`" :description="`Starting ${clipName(next)} ends the one you're running.`" :ui="{ title: 'wrap-anywhere', description: 'wrap-anywhere', footer: 'justify-end' }">
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="open = false" />
      <UButton label="End and start" class="min-h-10" data-test="program-replace-confirm" @click="emit('confirm')" />
    </template>
  </UModal>
</template>
