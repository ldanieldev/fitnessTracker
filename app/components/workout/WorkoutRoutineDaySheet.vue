<script setup lang="ts">
import type { RoutineDay } from '~~/shared/types/routine'

const props = defineProps<{ day: RoutineDay | null; busy?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [values: { name: string; description: string | null; floating: boolean }] }>()
const form = reactive({ name: '', description: '', floating: false })

watch(
  [open, () => props.day],
  ([isOpen, day]) => {
    if (!isOpen) return
    form.name = day?.name ?? ''
    form.description = day?.description ?? ''
    form.floating = day?.floating ?? false
  },
  { immediate: true }
)

function save() {
  const name = form.name.trim()
  if (!name) return
  open.value = false
  emit('save', { name, description: form.description.trim() || null, floating: form.floating })
}
</script>

<template>
  <AppSheet v-model:open="open" :title="day ? 'Edit day' : 'New day'">
    <template #body>
      <form class="flex flex-col gap-3" @submit.prevent="save">
        <UInput
          v-model="form.name"
          placeholder="Day name, e.g. Upper A"
          :maxlength="255"
          data-test="routine-day-name"
        />
        <UInput
          v-model="form.description"
          placeholder="Subtitle, e.g. Squat focus"
          :maxlength="255"
          data-test="routine-day-description"
        />
        <USwitch
          v-model="form.floating"
          label="Floating — outside the rotation, start any time"
          data-test="routine-day-floating"
        />
        <UButton
          type="submit"
          label="Save"
          block
          class="min-h-10"
          :disabled="busy || !form.name.trim()"
          data-test="routine-day-save"
        />
      </form>
    </template>
  </AppSheet>
</template>
