<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'

interface Container {
  id: number
  name: string
  sortOrder: number
  isArchived: boolean
}

const props = defineProps<{ containers: Container[] }>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()

const active = computed(() => [...props.containers].filter((c) => !c.isArchived).sort((a, b) => a.sortOrder - b.sortOrder))
const archived = computed(() => [...props.containers].filter((c) => c.isArchived).sort((a, b) => a.sortOrder - b.sortOrder))

const drafts = reactive<Record<number, string>>({})
watch(
  () => props.containers,
  (list) => {
    for (const c of list) drafts[c.id] = c.name
  },
  { immediate: true }
)

const savingId = ref<number | null>(null)

async function rename(container: Container) {
  const name = drafts[container.id]?.trim()
  if (!name || name === container.name) return
  savingId.value = container.id
  try {
    await $fetch(`/api/nutrition/meal-containers/${container.id}`, { method: 'PUT', body: { name } })
    emit('changed')
  } catch (error: unknown) {
    toast.add({ title: 'Rename failed', description: errorMessage(error, 'Could not rename container'), color: 'error' })
  } finally {
    savingId.value = null
  }
}

async function move(container: Container, direction: -1 | 1) {
  const list = active.value
  const index = list.findIndex((c) => c.id === container.id)
  const neighbor = list[index + direction]
  if (!neighbor) return
  try {
    // Sequential, not Promise.all: if the second PUT fails, only the partner has moved rather than both landing on the same sortOrder.
    await $fetch(`/api/nutrition/meal-containers/${neighbor.id}`, {
      method: 'PUT',
      body: { name: neighbor.name, sortOrder: container.sortOrder }
    })
    await $fetch(`/api/nutrition/meal-containers/${container.id}`, {
      method: 'PUT',
      body: { name: container.name, sortOrder: neighbor.sortOrder }
    })
  } catch (error: unknown) {
    toast.add({ title: 'Reorder failed', description: errorMessage(error, 'Could not reorder containers'), color: 'error' })
  } finally {
    emit('changed')
  }
}

const archiveTarget = ref<Container | null>(null)
const archiveModalOpen = computed({
  get: () => archiveTarget.value !== null,
  set: (value: boolean) => {
    if (!value) archiveTarget.value = null
  }
})

async function confirmArchive() {
  if (!archiveTarget.value) return
  try {
    await $fetch(`/api/nutrition/meal-containers/${archiveTarget.value.id}`, { method: 'DELETE' })
  } catch (error: unknown) {
    toast.add({ title: 'Archive failed', description: errorMessage(error, 'Could not archive container'), color: 'error' })
  } finally {
    archiveTarget.value = null
    emit('changed')
  }
}

const newName = ref('')
const adding = ref(false)

async function addContainer() {
  const name = newName.value.trim()
  if (!name) return
  adding.value = true
  try {
    await $fetch('/api/nutrition/meal-containers', { method: 'POST', body: { name } })
    newName.value = ''
    emit('changed')
  } catch (error: unknown) {
    toast.add({ title: 'Add failed', description: errorMessage(error, 'Could not add container'), color: 'error' })
  } finally {
    adding.value = false
  }
}

const showArchived = ref(false)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-for="(container, index) in active"
      :key="container.id"
      data-test="container-row"
      class="flex items-center gap-2"
    >
      <UInput
        v-model="drafts[container.id]"
        :data-test="`container-name-${container.id}`"
        class="flex-1"
        @keyup.enter="rename(container)"
      />
      <UButton
        icon="i-lucide-check"
        size="sm"
        variant="soft"
        aria-label="Save name"
        :loading="savingId === container.id"
        :data-test="`container-save-${container.id}`"
        @click="rename(container)"
      />
      <UButton
        icon="i-lucide-arrow-up"
        size="sm"
        variant="ghost"
        color="neutral"
        aria-label="Move up"
        :disabled="index === 0"
        :data-test="`container-up-${container.id}`"
        @click="move(container, -1)"
      />
      <UButton
        icon="i-lucide-arrow-down"
        size="sm"
        variant="ghost"
        color="neutral"
        aria-label="Move down"
        :disabled="index === active.length - 1"
        :data-test="`container-down-${container.id}`"
        @click="move(container, 1)"
      />
      <UButton
        icon="i-lucide-archive"
        size="sm"
        variant="ghost"
        color="error"
        aria-label="Archive container"
        :data-test="`container-archive-${container.id}`"
        @click="archiveTarget = container"
      />
    </div>

    <div class="flex items-center gap-2">
      <UInput
        v-model="newName"
        placeholder="New container name"
        data-test="add-container-input"
        class="flex-1"
        @keyup.enter="addContainer"
      />
      <UButton label="Add container" :loading="adding" data-test="add-container-submit" @click="addContainer" />
    </div>

    <div v-if="archived.length">
      <UButton
        :label="showArchived ? 'Hide archived' : `Archived (${archived.length})`"
        variant="ghost"
        color="neutral"
        size="sm"
        data-test="archived-toggle"
        @click="showArchived = !showArchived"
      />
      <div v-if="showArchived" class="flex flex-col gap-2 mt-2">
        <div
          v-for="container in archived"
          :key="container.id"
          data-test="archived-container-row"
          class="flex items-center justify-between text-sm text-dimmed"
        >
          <span>{{ container.name }}</span>
          <UBadge color="neutral" variant="subtle" label="Archived" />
        </div>
      </div>
    </div>

    <UModal
      v-model:open="archiveModalOpen"
      title="Archive container"
      :description="`Archive ${archiveTarget?.name}? Logged entries stay put.`"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="archiveTarget = null" />
          <UButton label="Archive" color="error" data-test="confirm-archive" @click="confirmArchive" />
        </div>
      </template>
    </UModal>
  </div>
</template>
