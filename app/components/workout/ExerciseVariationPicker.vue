<script setup lang="ts">
import type { Exercise } from '~~/shared/types/workout'

interface VariationGroup {
  id: number
  name: string
  exerciseIds: number[]
}
interface LinkTarget {
  groupId?: number
  name?: string
}

const props = defineProps<{ exercise: Exercise; groups: VariationGroup[] }>()
const emit = defineEmits<{ link: [payload: LinkTarget & { exerciseId: number }] }>()
const open = defineModel<boolean>('open', { default: false })

const currentGroup = computed(() => props.groups.find((g) => g.exerciseIds.includes(props.exercise.id)))

const creatingNew = ref(false)
const newName = ref('')
const pending = ref<{ target: LinkTarget; targetLabel: string } | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  creatingNew.value = false
  newName.value = props.exercise.name
  pending.value = null
})

function emitLink(target: LinkTarget) {
  emit('link', { ...target, exerciseId: props.exercise.id })
  pending.value = null
  open.value = false
}

function chooseGroup(group: VariationGroup) {
  if (currentGroup.value && currentGroup.value.id === group.id) return
  if (currentGroup.value) {
    pending.value = { target: { groupId: group.id }, targetLabel: group.name }
    return
  }
  emitLink({ groupId: group.id })
}

function openNew() {
  creatingNew.value = true
  newName.value = props.exercise.name
}

function saveNew() {
  const name = newName.value.trim()
  if (!name) return
  if (currentGroup.value) {
    pending.value = { target: { name }, targetLabel: name }
    return
  }
  emitLink({ name })
}

function confirmMove() {
  if (!pending.value) return
  emitLink(pending.value.target)
}

function cancelMove() {
  pending.value = null
}
</script>

<template>
  <AppSheet v-model:open="open" title="Link variation">
    <template #body>
      <div v-if="pending" class="flex flex-col gap-4">
        <p class="text-sm">Move {{ exercise.name }} from {{ currentGroup?.name }} to {{ pending.targetLabel }}?</p>
        <div class="flex gap-2">
          <UButton
            label="Cancel"
            variant="outline"
            color="neutral"
            class="min-h-10 flex-1"
            data-test="variation-move-cancel"
            @click="cancelMove"
          />
          <UButton label="Confirm" class="min-h-10 flex-1" data-test="variation-move-confirm" @click="confirmMove" />
        </div>
      </div>
      <div v-else class="flex flex-col gap-3">
        <UButton
          v-for="group in groups"
          :key="group.id"
          variant="soft"
          color="neutral"
          class="min-h-10 justify-between"
          :disabled="group.id === currentGroup?.id"
          :data-test="`variation-group-${group.id}`"
          @click="chooseGroup(group)"
        >
          <span>{{ group.name }}</span>
          <span class="text-xs text-dimmed">
            {{ group.exerciseIds.length }}<span v-if="group.id === currentGroup?.id"> · Current</span>
          </span>
        </UButton>

        <UButton
          v-if="!creatingNew"
          label="New group"
          variant="outline"
          color="neutral"
          class="min-h-10"
          data-test="variation-new"
          @click="openNew"
        />
        <div v-else class="flex flex-col gap-2">
          <UInput v-model="newName" placeholder="Group name" class="w-full" data-test="variation-name" />
          <UButton
            label="Save"
            class="min-h-10"
            :disabled="!newName.trim()"
            data-test="variation-save"
            @click="saveNew"
          />
        </div>
      </div>
    </template>
  </AppSheet>
</template>
