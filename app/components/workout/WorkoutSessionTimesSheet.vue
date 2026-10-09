<script setup lang="ts">
import { fromLocalInput, toLocalInput } from '~~/shared/utils/workoutTime'

const props = defineProps<{ startedAt: string; endedAt: string | null }>()

const emit = defineEmits<{
  save: [times: { startedAt: string; endedAt: string | null; performedOn: string }]
}>()

const open = defineModel<boolean>('open', { default: false })

const startInput = ref('')
const endInput = ref('')

watch(
  open,
  (value) => {
    if (!value) return
    startInput.value = toLocalInput(props.startedAt)
    endInput.value = props.endedAt ? toLocalInput(props.endedAt) : ''
  },
  { immediate: true }
)

function save() {
  const started = fromLocalInput(startInput.value)
  if (!started) return
  emit('save', {
    startedAt: started,
    endedAt: fromLocalInput(endInput.value),
    performedOn: startInput.value.slice(0, 10)
  })
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" title="Change date & time">
    <template #body>
      <div class="flex flex-col gap-3" data-test="session-times">
        <UFormField label="Started">
          <UInput v-model="startInput" type="datetime-local" class="w-full" data-test="session-start-input" />
        </UFormField>
        <UFormField label="Ended" hint="Leave empty to keep the workout open">
          <UInput v-model="endInput" type="datetime-local" class="w-full" data-test="session-end-input" />
        </UFormField>
        <UButton
          label="Save"
          block
          class="min-h-10"
          :disabled="!startInput"
          data-test="session-times-save"
          @click="save"
        />
      </div>
    </template>
  </AppSheet>
</template>
