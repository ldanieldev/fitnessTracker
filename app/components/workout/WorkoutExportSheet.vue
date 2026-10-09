<script setup lang="ts">
import type { SessionFilter } from '~~/shared/types/workout'
import { sessionFilterParams } from '~~/shared/utils/sessionFilter'

const props = defineProps<{ filter: SessionFilter }>()
const open = defineModel<boolean>('open', { default: false })

const from = ref('')
const to = ref('')
const error = ref('')

watch(open, (isOpen) => {
  if (isOpen) error.value = ''
})

function download() {
  if (from.value && to.value && from.value > to.value) {
    error.value = 'The end date is before the start date.'
    return
  }
  error.value = ''
  const query = sessionFilterParams({ ...props.filter, from: from.value || undefined, to: to.value || undefined })
  window.location.assign(`/api/workouts/sessions/export${query ? `?${query}` : ''}`)
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" title="Export CSV" description="Exports the workouts matching your current filter.">
    <template #body>
      <div class="flex flex-col gap-3" data-test="export-sheet">
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="From">
            <UInput v-model="from" type="date" class="w-full" data-test="export-from" />
          </UFormField>
          <UFormField label="To">
            <UInput v-model="to" type="date" class="w-full" data-test="export-to" />
          </UFormField>
        </div>
        <p class="text-xs text-dimmed">Leave a date blank to export from the first or to the latest workout.</p>
        <p v-if="error" class="text-sm text-error" data-test="export-error">{{ error }}</p>
        <UButton label="Download" icon="i-lucide-download" block class="min-h-10" data-test="export-download" @click="download" />
      </div>
    </template>
  </AppSheet>
</template>
