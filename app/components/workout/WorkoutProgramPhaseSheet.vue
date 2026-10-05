<script setup lang="ts">
import type { ProgramPhase } from '~~/shared/types/program'
import type { RoutineSummary } from '~~/shared/types/routine'

export interface PhaseValues { name: string, weeks: number, routineId: number | null, deload: boolean }

const REST = -1
const props = defineProps<{ phase: ProgramPhase | null, routines: RoutineSummary[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [values: PhaseValues] }>()
const form = reactive({ name: '', weeks: 4 as number | null, routine: REST, deload: false })
const touched = ref(false)

watch([open, () => props.phase], ([isOpen, phase]) => {
  if (!isOpen) return
  form.name = phase?.name ?? ''
  form.weeks = phase?.weeks ?? 4
  form.routine = phase ? (phase.routine?.id ?? REST) : (props.routines[0]?.id ?? REST)
  form.deload = phase?.deload ?? false
  touched.value = false
}, { immediate: true })

watch(() => props.routines.length, () => {
  if (open.value && !props.phase && !touched.value) form.routine = props.routines[0]?.id ?? REST
})

const items = computed(() => [
  ...props.routines.map((routine) => ({ label: routine.name, value: routine.id })),
  { label: 'None (rest week)', value: REST }
])
const valid = computed(() => form.name.trim() !== '' && form.weeks !== null && form.weeks >= 1 && form.weeks <= 104)

function save() {
  if (!valid.value) return
  open.value = false
  emit('save', { name: form.name.trim(), weeks: form.weeks!, routineId: form.routine === REST ? null : form.routine, deload: form.deload })
}
</script>

<template>
  <AppSheet v-model:open="open" :title="phase ? 'Edit phase' : 'New phase'">
    <template #body>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UInput v-model="form.name" placeholder="Phase name, e.g. Hypertrophy" :maxlength="255" data-test="phase-name" />
        <UFormField label="Weeks">
          <AppNumberInput v-model="form.weeks" :min="1" :max="104" :step="1" data-test="phase-weeks" />
        </UFormField>
        <UFormField label="Routine">
          <USelect v-model="form.routine" :items="items" class="w-full" data-test="phase-routine" @update:model-value="touched = true" />
        </UFormField>
        <USwitch v-model="form.deload" label="Deload" data-test="phase-deload" />
        <UButton type="submit" label="Save" block class="min-h-10" :disabled="!valid" data-test="phase-save" />
      </form>
    </template>
  </AppSheet>
</template>
