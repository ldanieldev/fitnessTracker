<script setup lang="ts">
import type { MeasurementDirection, MeasurementType } from '~~/shared/types/body'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ type: MeasurementType | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const name = ref('')
const unit = ref('')
const precision = ref(1)
const direction = ref<MeasurementDirection>('neutral')
const saving = ref(false)
const confirmingDelete = ref(false)

const precisionItems = [
  { label: '0 decimals', value: 0 },
  { label: '1 decimal', value: 1 },
  { label: '2 decimals', value: 2 },
  { label: '3 decimals', value: 3 }
]
const directionItems = [
  { label: 'Neutral', value: 'neutral' },
  { label: 'Lower is better', value: 'lower' },
  { label: 'Higher is better', value: 'higher' }
]

watch(open, (isOpen) => {
  if (!isOpen) return
  confirmingDelete.value = false
  name.value = props.type?.name ?? ''
  unit.value = props.type?.unit ?? ''
  precision.value = props.type?.precision ?? 1
  direction.value = props.type?.direction ?? 'neutral'
}, { immediate: true })

const canSave = computed(() => name.value.trim() !== '' && unit.value.trim() !== '' && !saving.value)

function invalidate() {
  return invalidateBody(BODY_KEYS.overview, BODY_KEYS.types, BODY_KEYS.typesAll)
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  const body = { name: name.value.trim(), unit: unit.value.trim(), precision: precision.value, direction: direction.value }
  try {
    if (props.type) await apiFetch(`/api/body/types/${props.type.id}`, { method: 'PATCH', body })
    else await apiFetch('/api/body/types', { method: 'POST', body })
    await invalidate()
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save this measurement type'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}

async function remove() {
  if (!props.type || saving.value) return
  saving.value = true
  try {
    await apiFetch(`/api/body/types/${props.type.id}`, { method: 'DELETE' })
    await invalidate()
  } catch (error: unknown) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Could not delete this measurement type'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" :title="type ? `Edit ${type.name}` : 'New measurement'">
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField label="Name">
          <UInput v-model="name" :maxlength="64" class="w-full" data-test="type-name" />
        </UFormField>
        <div class="grid grid-cols-2 gap-2">
          <UFormField label="Unit">
            <UInput v-model="unit" :maxlength="16" placeholder="in, lbs, %" class="w-full" data-test="type-unit" />
          </UFormField>
          <UFormField label="Precision">
            <USelect v-model="precision" :items="precisionItems" class="w-full" data-test="type-precision" />
          </UFormField>
        </div>
        <UFormField label="Better when">
          <USelect v-model="direction" :items="directionItems" class="w-full" data-test="type-direction" />
        </UFormField>
        <div v-if="!confirmingDelete" class="flex w-full gap-2">
          <UButton v-if="type" icon="i-lucide-trash-2" color="error" variant="soft" aria-label="Delete measurement type" data-test="type-delete" @click="confirmingDelete = true" />
          <UButton label="Save" class="ml-auto" :loading="saving" :disabled="!canSave" data-test="type-save" @click="save" />
        </div>
        <p v-if="type" class="text-xs text-dimmed">Deleting hides this measurement; its readings are kept.</p>
      </div>
    </template>
    <template v-if="type && confirmingDelete" #footer>
      <div class="flex w-full gap-2">
        <UButton label="Cancel" color="neutral" variant="outline" @click="confirmingDelete = false" />
        <UButton label="Delete" color="error" class="ml-auto" :loading="saving" data-test="type-delete-confirm" @click="remove" />
      </div>
    </template>
  </AppSheet>
</template>
