<script setup lang="ts">
import type { WorkoutSet } from '~/types/workout'

const props = defineProps<{
  set: WorkoutSet
}>()

const emit = defineEmits<{
  delete: []
  'update:note': [note: string]
  'update:set': [data: { weight: number; reps: number; rpe: number }]
}>()

const showNote = ref(props.set.note.length > 0)
const editing = ref(false)
const editWeight = ref(props.set.weight)
const editReps = ref(props.set.reps)
const editRpe = ref(props.set.rpe)

function startEdit() {
  editWeight.value = props.set.weight
  editReps.value = props.set.reps
  editRpe.value = props.set.rpe
  editing.value = true
}

function saveEdit() {
  emit('update:set', { weight: editWeight.value, reps: editReps.value, rpe: editRpe.value })
  editing.value = false
}

function cancelEdit() {
  editing.value = false
}

const menuItems = [
  [
    {
      label: 'Edit',
      icon: 'i-lucide-pencil',
      onSelect: () => startEdit()
    },
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error' as const,
      onSelect: () => emit('delete')
    }
  ]
]
</script>

<template>
  <div class="flex flex-col gap-1">
    <!-- Edit mode -->
    <div v-if="editing" class="flex flex-col gap-2 py-2 px-3 rounded-lg bg-elevated/50">
      <div class="flex items-center gap-3 text-sm">
        <span class="text-dimmed w-12 shrink-0">Set {{ props.set.setNumber }}</span>
        <div class="flex items-center gap-1">
          <UInputNumber v-model="editWeight" :min="0" :step="5" size="xs" class="w-24" />
          <span class="text-xs text-dimmed">lbs</span>
        </div>
        <div class="flex items-center gap-1">
          <UInputNumber v-model="editReps" :min="1" :step="1" size="xs" class="w-20" />
          <span class="text-xs text-dimmed">reps</span>
        </div>
        <div class="flex items-center gap-1">
          <UInputNumber v-model="editRpe" :min="1" :max="10" :step="1" size="xs" class="w-20" />
          <span class="text-xs text-dimmed">RPE</span>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" variant="ghost" color="neutral" size="xs" @click="cancelEdit" />
        <UButton label="Save" size="xs" @click="saveEdit" />
      </div>
    </div>

    <!-- Display mode -->
    <div v-else class="flex items-center gap-3 py-2 px-3 rounded-lg bg-elevated/50 text-sm">
      <span class="text-dimmed w-12 shrink-0">Set {{ props.set.setNumber }}</span>
      <span class="w-20 font-medium">{{ props.set.weight }} lbs</span>
      <span class="w-16">{{ props.set.reps }} reps</span>
      <span class="w-14 text-dimmed">RPE {{ props.set.rpe }}</span>
      <span class="ml-auto text-dimmed text-right shrink-0">{{ props.set.weight * props.set.reps }} vol</span>
      <UButton
        icon="i-lucide-message-square"
        variant="ghost"
        :color="set.note ? 'primary' : 'neutral'"
        size="xs"
        class="shrink-0"
        @click="showNote = !showNote"
      />
      <UDropdownMenu :items="menuItems">
        <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" size="xs" class="shrink-0" />
      </UDropdownMenu>
    </div>
    <UTextarea
      v-if="showNote"
      :model-value="props.set.note"
      placeholder="Add a note..."
      :rows="1"
      autoresize
      size="sm"
      class="mx-3"
      @update:model-value="emit('update:note', String($event ?? ''))"
    />
  </div>
</template>
