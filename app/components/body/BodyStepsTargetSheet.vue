<script setup lang="ts">
import type { StepTarget } from '~~/shared/types/steps'
import { weekStartOf } from '~~/shared/utils/programs'
import { formatSteps, STEPS_MAX } from '~~/shared/utils/steps'
import { errorMessage } from '~/utils/apiError'

const props = defineProps<{ target: StepTarget | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const { user } = useUserSession()
const today = useTodayOrNow()
const daily = ref<number | null>(null)
const from = ref('')
const saving = ref(false)

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    daily.value = props.target?.dailyTarget ?? null
    from.value = weekStartOf(today.value, user.value?.weekStart === 0 ? 0 : 1)
  },
  { immediate: true }
)

const valid = computed(
  () => daily.value !== null && Number.isInteger(daily.value) && daily.value >= 1 && daily.value <= STEPS_MAX
)
const weekly = computed(() => (valid.value ? daily.value! * 7 : null))

async function save() {
  if (!valid.value || from.value === '') return
  saving.value = true
  try {
    await apiFetch('/api/body/steps/target', {
      method: 'PUT',
      body: { dailyTarget: daily.value, effectiveFrom: from.value }
    })
    await invalidateBody(BODY_KEYS.steps)
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save the target'), color: 'error' })
    return
  } finally {
    saving.value = false
  }
  emit('saved')
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" title="Steps target">
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField label="Daily target">
          <AppNumberInput
            v-model="daily"
            :min="1"
            :max="STEPS_MAX"
            :step="500"
            class="w-full"
            data-test="target-daily"
          />
        </UFormField>
        <p class="text-sm tabular-nums text-muted" data-test="target-weekly">{{ formatSteps(weekly) }} per week</p>
        <UFormField label="Effective from">
          <UInput v-model="from" type="date" class="w-full" data-test="target-from" />
        </UFormField>
        <UButton
          label="Save"
          class="ml-auto min-h-10"
          :loading="saving"
          :disabled="!valid || from === '' || saving"
          data-test="target-save"
          @click="save"
        />
      </div>
    </template>
  </AppSheet>
</template>
