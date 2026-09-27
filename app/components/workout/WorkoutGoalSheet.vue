<script setup lang="ts">
import type { GraphMetric, WorkoutGoal } from '~~/shared/types/workout'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{
  exerciseId: number
  metric: GraphMetric
  reps: number | null
  unit: string
  goal: WorkoutGoal | null
}>()
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()
const target = ref<number | null>(null)
const date = ref('')
const saving = ref(false)
const validationError = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  validationError.value = ''
  target.value = props.goal?.targetValue ?? null
  date.value = props.goal?.targetDate ?? ''
}, { immediate: true })

async function save() {
  if (target.value === null || target.value <= 0) {
    validationError.value = 'Enter a target above zero'
    return
  }
  validationError.value = ''
  saving.value = true
  try {
    await apiFetch(`/api/workouts/exercises/${props.exerciseId}/goal`, {
      method: 'PUT',
      body: { metric: props.metric, targetValue: target.value, targetReps: props.reps, targetDate: date.value || null }
    })
    await invalidateWorkouts()
  } catch (error: unknown) {
    toast.add({
      title: 'Could not save goal',
      description: errorMessage(error, 'Could not save this goal'),
      color: 'error'
    })
    return
  } finally {
    saving.value = false
  }
  open.value = false
}

async function remove() {
  if (saving.value) return
  saving.value = true
  try {
    await apiFetch(`/api/workouts/exercises/${props.exerciseId}/goal?metric=${props.metric}`, { method: 'DELETE' })
    await invalidateWorkouts()
  } catch (error: unknown) {
    toast.add({
      title: 'Could not save goal',
      description: errorMessage(error, 'Could not remove this goal'),
      color: 'error'
    })
    return
  } finally {
    saving.value = false
  }
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" title="Goal">
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField :label="`Target (${unit})`">
          <AppNumberInput v-model="target" :min="0" class="w-full" data-test="goal-target" />
        </UFormField>
        <UFormField label="By (optional)">
          <UInput v-model="date" type="date" class="w-full" data-test="goal-date" />
        </UFormField>
        <p v-if="validationError" class="text-sm text-error">{{ validationError }}</p>
        <div class="flex w-full gap-2">
          <UButton v-if="goal" label="Remove" color="error" variant="soft" :loading="saving" data-test="goal-remove" @click="remove" />
          <UButton label="Save" class="ml-auto" :loading="saving" data-test="goal-save" @click="save" />
        </div>
      </div>
    </template>
  </AppSheet>
</template>
