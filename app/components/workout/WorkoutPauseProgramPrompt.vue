<script setup lang="ts">
defineProps<{ programName: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UModal v-model:open="open" :title="`Pause ${programName}?`" description="It controls your active routine. Pausing lets you switch; resume it from Programs." :ui="{ footer: 'justify-end' }">
    <template #footer>
      <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="open = false" />
      <UButton label="Pause and switch" class="min-h-10" data-test="pause-program-confirm" @click="emit('confirm')" />
    </template>
  </UModal>
</template>
