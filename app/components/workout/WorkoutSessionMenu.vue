<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkoutSession } from '~~/shared/types/workout'

const props = defineProps<{ session: WorkoutSession; extraItems?: DropdownMenuItem[][] }>()

const emit = defineEmits<{
  'update:session': [session: WorkoutSession]
  delete: []
}>()

const fail = useFailToast()
const commentOpen = ref(false)
const timesOpen = ref(false)
const deleteOpen = ref(false)
const commentText = ref('')

const { manualOpen, manualText, shareSession } = useWorkoutShare()

async function patch(body: Record<string, unknown>, title: string, fallback: string) {
  try {
    emit(
      'update:session',
      await apiFetch<WorkoutSession>(`/api/workouts/sessions/${props.session.id}`, { method: 'PATCH', body })
    )
  } catch (err: unknown) {
    fail(title, err, fallback)
  }
}

const menu = computed<DropdownMenuItem[][]>(() => [
  ...(props.extraItems ?? []),
  [
    { label: 'Comment', icon: 'i-lucide-notebook-pen', onSelect: () => openComment() },
    {
      label: 'Change date & time',
      icon: 'i-lucide-calendar-clock',
      onSelect: () => {
        timesOpen.value = true
      }
    },
    {
      label: 'Share',
      icon: 'i-lucide-share-2',
      onSelect: () => {
        void shareSession(props.session)
      }
    }
  ],
  [
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error',
      onSelect: () => {
        deleteOpen.value = true
      }
    }
  ]
])

function openComment() {
  commentText.value = props.session.notes ?? ''
  commentOpen.value = true
}

function saveComment() {
  commentOpen.value = false
  void patch({ notes: commentText.value.trim() || null }, 'Couldn\'t save comment', 'Could not save this comment')
}

function saveTimes(times: { startedAt: string; endedAt: string | null; performedOn: string }) {
  void patch(times, 'Couldn\'t change date and time', 'Could not change the date and time')
}

function confirmDelete() {
  emit('delete')
  deleteOpen.value = false
}
</script>

<template>
  <AppMenuButton :items="menu" label="Workout options" test-id="session-menu" />

  <AppSheet v-model:open="commentOpen" title="Workout comment">
    <template #body>
      <div class="flex flex-col gap-3" data-test="session-comment">
        <UTextarea v-model="commentText" :rows="4" :maxlength="2000" class="w-full" data-test="session-comment-input" />
        <UButton label="Save" block class="min-h-10" data-test="session-comment-save" @click="saveComment" />
      </div>
    </template>
  </AppSheet>

  <WorkoutSessionTimesSheet
    v-model:open="timesOpen"
    :started-at="session.startedAt"
    :ended-at="session.endedAt"
    @save="saveTimes"
  />

  <WorkoutShareSheet v-model:open="manualOpen" :text="manualText" />

  <AppSheet v-model:open="deleteOpen" title="Delete workout">
    <template #body>
      <div class="flex flex-col gap-3" data-test="session-delete">
        <p class="text-sm text-muted">This removes the workout and every set logged in it.</p>
        <UButton
          label="Delete"
          color="error"
          block
          class="min-h-10"
          data-test="session-delete-confirm"
          @click="confirmDelete"
        />
      </div>
    </template>
  </AppSheet>
</template>
