<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ date: string, notes: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const text = ref(props.notes ?? '')
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) text.value = props.notes ?? ''
})

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    await $fetch(`/api/nutrition/diary/${props.date}/notes`, { method: 'PUT', body: { notes: text.value.trim() || null } })
    await invalidateNutrition(NUTRITION_KEYS.day(props.date))
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save these notes'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <NutritionSheet v-model:open="open" title="Day notes">
    <template #body>
      <div class="flex flex-col gap-3">
        <UTextarea v-model="text" :rows="5" :maxlength="5000" class="w-full" data-test="day-notes-input" />
        <UButton label="Save" block :loading="saving" :disabled="saving" data-test="day-notes-save" @click="save" />
      </div>
    </template>
  </NutritionSheet>
</template>
