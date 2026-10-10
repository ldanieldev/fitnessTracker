<script setup lang="ts">
import type { StepDay } from '~~/shared/types/steps'
import { STEPS_MAX } from '~~/shared/utils/steps'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ date: string | null; known: Record<string, number> }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const today = useTodayOrNow()
const day = ref('')
const steps = ref<number | null>(null)
const saving = ref(false)
const confirmingDelete = ref(false)
const looked = ref<Record<string, number>>({})
const counts = computed(() => ({ ...looked.value, ...props.known }))

async function lookUp(date: string) {
  if (date === '' || date > today.value || props.known[date] !== undefined) return
  try {
    const { day: found } = await apiFetch<{ day: StepDay | null }>(`/api/body/steps/days/${date}`)
    if (!found) return
    looked.value = { ...looked.value, [date]: found.steps }
    if (day.value === date && steps.value === null) steps.value = found.steps
  } catch {
    // A failed lookup leaves the day unknown; Save still upserts, so nothing is lost.
  }
}

function showDay(date: string) {
  steps.value = counts.value[date] ?? null
  confirmingDelete.value = false
  lookUp(date)
}

watch(day, showDay)
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    looked.value = {}
    const next = props.date ?? today.value
    if (day.value === next) showDay(next)
    else day.value = next
  },
  { immediate: true }
)

const existing = computed(() => counts.value[day.value] !== undefined)
const canSave = computed(
  () =>
    steps.value !== null &&
    Number.isInteger(steps.value) &&
    steps.value >= 0 &&
    steps.value <= STEPS_MAX &&
    day.value !== '' &&
    day.value <= today.value &&
    !saving.value
)

function submit() {
  if (canSave.value) send('PUT')
}

async function send(method: 'PUT' | 'DELETE') {
  saving.value = true
  try {
    await apiFetch(`/api/body/steps/days/${day.value}`, {
      method,
      body: method === 'PUT' ? { steps: steps.value } : undefined
    })
    await invalidateBody(BODY_KEYS.steps)
  } catch (error: unknown) {
    toast.add({
      title: method === 'PUT' ? 'Save failed' : 'Delete failed',
      description: errorMessage(error, 'Could not update steps'),
      color: 'error'
    })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" :title="existing ? 'Edit steps' : 'Log steps'">
    <template #body>
      <form class="flex flex-col gap-3" data-test="steps-form" @submit.prevent="submit">
        <UFormField label="Steps">
          <AppNumberInput
            v-model="steps"
            :min="0"
            :max="STEPS_MAX"
            :step="1"
            autofocus
            class="w-full"
            data-test="steps-value"
          />
        </UFormField>
        <UFormField label="Date">
          <UInput v-model="day" type="date" :max="today" class="w-full" data-test="steps-date" />
        </UFormField>
        <div v-if="!confirmingDelete" class="flex w-full gap-2">
          <UButton
            v-if="existing"
            icon="i-lucide-trash-2"
            color="error"
            variant="soft"
            aria-label="Delete steps"
            class="min-h-10 min-w-10"
            data-test="steps-delete"
            @click="confirmingDelete = true"
          />
          <UButton
            type="submit"
            label="Save"
            class="ml-auto min-h-10"
            :loading="saving"
            :disabled="!canSave"
            data-test="steps-save"
          />
        </div>
      </form>
    </template>
    <template v-if="existing && confirmingDelete" #footer>
      <div class="flex w-full gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          class="min-h-10"
          @click="confirmingDelete = false"
        />
        <UButton
          label="Delete"
          color="error"
          class="ml-auto min-h-10"
          :loading="saving"
          data-test="steps-delete-confirm"
          @click="send('DELETE')"
        />
      </div>
    </template>
  </AppSheet>
</template>
