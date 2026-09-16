<script setup lang="ts">
import type { MeasurementGoal, MeasurementType } from '~~/shared/types/body'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ type: MeasurementType | null, goal: MeasurementGoal | null, latest: number | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const target = ref<number | null>(null)
const date = ref('')
const saving = ref(false)
const confirmingClear = ref(false)

watch(open, (isOpen) => {
  if (!isOpen) return
  confirmingClear.value = false
  target.value = props.goal?.targetValue ?? null
  date.value = props.goal?.targetDate ?? ''
}, { immediate: true })

const step = computed(() => (props.type ? 10 ** -props.type.precision : 1))
const canSave = computed(() => target.value !== null && props.latest !== null && !saving.value)

function invalidate(typeId: number) {
  return invalidateBody(BODY_KEYS.overview, BODY_KEYS.goals, BODY_KEYS.series(typeId))
}

async function save() {
  if (!props.type || !canSave.value) return
  saving.value = true
  try {
    await apiFetch(`/api/body/types/${props.type.id}/goal`, { method: 'PUT', body: { targetValue: target.value, targetDate: date.value || null } })
    await invalidate(props.type.id)
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save this goal'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}

async function clear() {
  if (!props.type || saving.value) return
  saving.value = true
  try {
    await apiFetch(`/api/body/types/${props.type.id}/goal`, { method: 'DELETE' })
    await invalidate(props.type.id)
  } catch (error: unknown) {
    toast.add({ title: 'Clear failed', description: errorMessage(error, 'Could not clear this goal'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" :title="`${type?.name ?? ''} goal`">
    <template #body>
      <div v-if="type" class="flex flex-col gap-3">
        <p v-if="latest === null" class="text-sm text-dimmed">Log a reading first — the goal measures progress from your latest value.</p>
        <UFormField :label="`Target (${type.unit})`">
          <AppNumberInput v-model="target" :min="0" :step="step" class="w-full" data-test="goal-target" />
        </UFormField>
        <UFormField label="By (optional)">
          <UInput v-model="date" type="date" class="w-full" data-test="goal-date" />
        </UFormField>
        <div v-if="!confirmingClear" class="flex w-full gap-2">
          <UButton v-if="goal" label="Clear goal" color="error" variant="soft" data-test="goal-clear" @click="confirmingClear = true" />
          <UButton label="Save" class="ml-auto" :loading="saving" :disabled="!canSave" data-test="goal-save" @click="save" />
        </div>
      </div>
    </template>
    <template v-if="goal && confirmingClear" #footer>
      <div class="flex w-full gap-2">
        <UButton label="Cancel" color="neutral" variant="outline" @click="confirmingClear = false" />
        <UButton label="Clear" color="error" class="ml-auto" :loading="saving" data-test="goal-clear-confirm" @click="clear" />
      </div>
    </template>
  </AppSheet>
</template>
