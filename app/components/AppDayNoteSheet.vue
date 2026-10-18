<script setup lang="ts">
import { formatDayLabel } from '~~/shared/utils/dayLabel'

const props = defineProps<{ date: string; note: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [note: string | null] }>()

const fail = useFailToast()
const text = ref(props.note ?? '')
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) text.value = props.note ?? ''
})

async function save() {
  if (saving.value) return
  saving.value = true
  let saved: string | null
  try {
    const result = await apiFetch<{ note: string | null }>(`/api/days/${props.date}/note`, {
      method: 'PUT',
      body: { note: text.value.trim() || null }
    })
    saved = result.note
  } catch (error: unknown) {
    fail('Save failed', error, 'Could not save this note')
    return
  } finally {
    saving.value = false
  }
  emit('saved', saved)
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" title="Day notes" :description="formatDayLabel(date)">
    <template #body>
      <div class="flex flex-col gap-3">
        <UTextarea
          v-model="text"
          :rows="5"
          :maxlength="5000"
          aria-label="Day notes"
          class="w-full"
          data-test="day-notes-input"
        />
        <UButton label="Save" block :loading="saving" :disabled="saving" data-test="day-notes-save" @click="save" />
      </div>
    </template>
  </AppSheet>
</template>
