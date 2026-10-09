<script setup lang="ts">
import { format } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkoutSession } from '~~/shared/types/workout'
import { durationLabel } from '~~/shared/utils/workoutTime'

const props = defineProps<{ session: WorkoutSession }>()

const emit = defineEmits<{
  rename: [name: string | null]
  comment: [notes: string | null]
  changeTimes: [times: { startedAt: string, endedAt: string | null, performedOn: string }]
  delete: []
}>()

const name = ref(props.session.name ?? '')
watch(() => props.session.name, (value) => {
  name.value = value ?? ''
})

function saveName() {
  const value = name.value.trim() || null
  if (value === (props.session.name ?? null)) return
  emit('rename', value)
}

// Starting the clock at startedAt keeps the first client render equal to SSR's; the real time arrives on mount.
const now = ref(new Date(props.session.startedAt).getTime())
let ticker: ReturnType<typeof setInterval> | undefined

function stopTicker() {
  clearInterval(ticker)
  ticker = undefined
}

function startTicker() {
  if (ticker) return
  ticker = setInterval(() => {
    now.value = Date.now()
  }, 1000)
}

onMounted(() => {
  now.value = Date.now()
  if (!props.session.endedAt) startTicker()
})
onBeforeUnmount(stopTicker)
watch(() => props.session.endedAt, (endedAt) => {
  if (endedAt) stopTicker()
  else startTicker()
})

const elapsedLabel = computed(() =>
  durationLabel(props.session.startedAt, props.session.endedAt ? new Date(props.session.endedAt).getTime() : now.value)
)

const dateLabel = computed(() => format(new Date(`${props.session.performedOn}T00:00:00`), 'EEE, MMM d'))

const commentOpen = ref(false)
const timesOpen = ref(false)
const deleteOpen = ref(false)

const commentText = ref('')

const { manualOpen, manualText, shareSession } = useWorkoutShare()

const menu: DropdownMenuItem[][] = [
  [
    { label: 'Comment', icon: 'i-lucide-notebook-pen', onSelect: () => openComment() },
    { label: 'Change date & time', icon: 'i-lucide-calendar-clock', onSelect: () => { timesOpen.value = true } },
    { label: 'Share', icon: 'i-lucide-share-2', onSelect: () => { void shareSession(props.session) } }
  ],
  [{ label: 'Delete', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { deleteOpen.value = true } }]
]

function openComment() {
  commentText.value = props.session.notes ?? ''
  commentOpen.value = true
}

function saveComment() {
  emit('comment', commentText.value.trim() || null)
  commentOpen.value = false
}

function confirmDelete() {
  emit('delete')
  deleteOpen.value = false
}
</script>

<template>
  <div class="flex flex-col gap-1" data-test="session-header">
    <div class="flex items-center gap-1">
      <UInput
        v-model="name"
        variant="ghost"
        placeholder="Workout name"
        class="min-w-0 flex-1"
        :ui="{ base: 'min-h-10 text-base font-semibold' }"
        data-test="session-name"
        @blur="saveName"
      />
      <span class="shrink-0 text-sm tabular-nums text-dimmed" data-test="session-elapsed">{{ elapsedLabel }}</span>
      <UDropdownMenu :items="menu">
        <UButton
          icon="i-lucide-ellipsis-vertical"
          variant="ghost"
          color="neutral"
          class="min-h-10 min-w-10 justify-center"
          aria-label="Workout options"
          data-test="session-menu"
        />
      </UDropdownMenu>
    </div>
    <div class="flex items-center gap-2 px-2.5 text-xs text-dimmed">
      <span data-test="session-date-label">{{ dateLabel }}</span>
      <span v-if="session.notes" class="truncate" data-test="session-notes">{{ session.notes }}</span>
    </div>

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
      @save="(times) => emit('changeTimes', times)"
    />

    <WorkoutShareSheet v-model:open="manualOpen" :text="manualText" />

    <AppSheet v-model:open="deleteOpen" title="Delete workout">
      <template #body>
        <div class="flex flex-col gap-3" data-test="session-delete">
          <p class="text-sm text-muted">This removes the workout and every set logged in it.</p>
          <UButton label="Delete" color="error" block class="min-h-10" data-test="session-delete-confirm" @click="confirmDelete" />
        </div>
      </template>
    </AppSheet>
  </div>
</template>
