<script setup lang="ts">
import { format } from 'date-fns'
import type { MeasurementEntry, MeasurementType } from '~~/shared/types/body'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ type: MeasurementType | null, entry: MeasurementEntry | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const today = useToday()
const value = ref<number | null>(null)
const date = ref('')
const time = ref('')
const saving = ref(false)
const confirmingDelete = ref(false)

function reset() {
  confirmingDelete.value = false
  if (props.entry) {
    value.value = props.entry.value
    date.value = props.entry.measuredOn
    time.value = format(new Date(props.entry.measuredAt), 'HH:mm')
  } else {
    value.value = null
    date.value = today.value ?? todayDate()
    time.value = format(new Date(), 'HH:mm')
  }
}
watch(open, (isOpen) => {
  if (isOpen) reset()
}, { immediate: true })

const step = computed(() => (props.type ? 10 ** -props.type.precision : 1))
const canSave = computed(() => value.value !== null && date.value !== '' && time.value !== '' && !saving.value)

function invalidate(typeId: number) {
  return invalidateBody(BODY_KEYS.overview, BODY_KEYS.entries(typeId), BODY_KEYS.series(typeId), BODY_KEYS.goals)
}

async function save() {
  if (!props.type || !canSave.value) return
  saving.value = true
  const body = { value: value.value, measuredAt: new Date(`${date.value}T${time.value}:00`).toISOString(), measuredOn: date.value }
  try {
    if (props.entry) await apiFetch(`/api/body/entries/${props.entry.id}`, { method: 'PATCH', body })
    else await apiFetch('/api/body/entries', { method: 'POST', body: { typeId: props.type.id, ...body } })
    await invalidate(props.type.id)
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save this measurement'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}

async function remove() {
  if (!props.entry || !props.type || saving.value) return
  saving.value = true
  try {
    await apiFetch(`/api/body/entries/${props.entry.id}`, { method: 'DELETE' })
    await invalidate(props.type.id)
  } catch (error: unknown) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Could not delete this measurement'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" :title="entry ? `Edit ${type?.name ?? ''}` : `Log ${type?.name ?? ''}`">
    <template #body>
      <div v-if="type" class="flex flex-col gap-3">
        <UFormField :label="`Value (${type.unit})`">
          <AppNumberInput v-model="value" :min="0" :step="step" class="w-full" data-test="entry-value" />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Date">
            <UInput v-model="date" type="date" class="w-full" data-test="entry-date" />
          </UFormField>
          <UFormField label="Time">
            <UInput v-model="time" type="time" class="w-full" data-test="entry-time" />
          </UFormField>
        </div>
        <div v-if="!confirmingDelete" class="flex w-full gap-2">
          <UButton v-if="entry" icon="i-lucide-trash-2" color="error" variant="soft" aria-label="Delete measurement" data-test="entry-delete" @click="confirmingDelete = true" />
          <UButton label="Save" class="ml-auto" :loading="saving" :disabled="!canSave" data-test="entry-save" @click="save" />
        </div>
      </div>
    </template>
    <template v-if="entry && confirmingDelete" #footer>
      <div class="flex w-full gap-2">
        <UButton label="Cancel" color="neutral" variant="outline" @click="confirmingDelete = false" />
        <UButton label="Delete" color="error" class="ml-auto" :loading="saving" data-test="entry-delete-confirm" @click="remove" />
      </div>
    </template>
  </AppSheet>
</template>
