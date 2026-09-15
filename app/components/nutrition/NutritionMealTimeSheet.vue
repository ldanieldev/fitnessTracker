<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ date: string, containerId: number, value: string | null, hasStored: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const time = ref(props.value ?? '')
const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) time.value = props.value ?? ''
})

async function save(value: string | null) {
  if (saving.value) return
  saving.value = true
  try {
    await apiFetch(`/api/nutrition/diary/${props.date}/meal-time`, { method: 'PUT', body: { containerId: props.containerId, time: value } })
    await invalidateNutrition(NUTRITION_KEYS.day(props.date))
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save this meal time'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <NutritionSheet v-model:open="open" title="Meal time">
    <template #body>
      <div class="flex flex-col gap-3">
        <UInput v-model="time" type="time" class="w-full" data-test="meal-time-input" />
        <UButton label="Save" block :loading="saving" :disabled="saving || !time" data-test="meal-time-save" @click="save(time)" />
        <UButton
          v-if="hasStored"
          label="Use first entry"
          block
          color="neutral"
          variant="soft"
          :disabled="saving"
          data-test="meal-time-reset"
          @click="save(null)"
        />
      </div>
    </template>
  </NutritionSheet>
</template>
