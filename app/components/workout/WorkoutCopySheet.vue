<script setup lang="ts">
import { format } from 'date-fns'
import type { WorkoutSession, WorkoutSessionSummary } from '~~/shared/types/workout'
import { plural } from '~/utils/plural'

const props = defineProps<{ sourceId?: number | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ start: [body: { copyFromId: number, entryIds: number[] }] }>()
const fail = useFailToast()

const recent = ref<WorkoutSessionSummary[]>([])
const source = ref<WorkoutSession | null>(null)
const picked = ref<number[]>([])

async function pickSource(id: number) {
  try {
    source.value = await apiFetch<WorkoutSession>(`/api/workouts/sessions/${id}`)
    picked.value = source.value.entries.map((entry) => entry.id)
  } catch (err: unknown) {
    fail('Couldn\'t load workout', err, 'Could not load this workout')
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  source.value = null
  if (props.sourceId) return pickSource(props.sourceId)
  try {
    recent.value = await apiFetch<WorkoutSessionSummary[]>('/api/workouts/sessions?limit=10')
  } catch (err: unknown) {
    fail('Couldn\'t load past workouts', err, 'Could not load past workouts')
  }
}, { immediate: true })

function toggle(id: number) {
  picked.value = picked.value.includes(id) ? picked.value.filter((value) => value !== id) : [...picked.value, id]
}

function startCopy() {
  if (!source.value || !picked.value.length) return
  open.value = false
  emit('start', { copyFromId: source.value.id, entryIds: source.value.entries.map((e) => e.id).filter((id) => picked.value.includes(id)) })
}

function recentLine(summary: WorkoutSessionSummary) {
  const when = format(new Date(`${summary.performedOn}T00:00:00`), 'EEE, MMM d')
  return `${when} · ${plural(summary.exerciseCount, 'exercise')} · ${plural(summary.setCount, 'set')}`
}
</script>

<template>
  <AppSheet v-model:open="open" :title="source ? `Copy ${source.name ?? 'workout'}` : 'Copy a past workout'">
    <template #body>
      <div v-if="!source" class="flex flex-col gap-1" data-test="copy-list">
        <p v-if="!recent.length" class="text-sm text-dimmed">No past workouts yet</p>
        <button
          v-for="summary in recent"
          :key="summary.id"
          type="button"
          class="flex min-h-10 flex-col rounded-lg px-2 py-2 text-left hover:bg-elevated"
          :data-test="`copy-session-${summary.id}`"
          @click="pickSource(summary.id)"
        >
          <span class="truncate font-medium text-highlighted">{{ summary.name ?? 'Workout' }}</span>
          <span class="truncate text-xs text-dimmed">{{ recentLine(summary) }}</span>
        </button>
      </div>
      <div v-else class="flex flex-col gap-1">
        <UButton v-if="!sourceId" label="Past workouts" icon="i-lucide-arrow-left" variant="ghost" color="neutral" class="min-h-10 self-start" data-test="copy-back" @click="source = null" />
        <button
          v-for="entry in source.entries"
          :key="entry.id"
          type="button"
          class="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left hover:bg-elevated"
          :aria-pressed="picked.includes(entry.id)"
          :data-test="`copy-entry-${entry.id}`"
          @click="toggle(entry.id)"
        >
          <UIcon :name="picked.includes(entry.id) ? 'i-lucide-square-check' : 'i-lucide-square'" class="size-5 shrink-0" />
          <span class="min-w-0 flex-1 truncate">{{ entry.exerciseName }}</span>
          <span class="shrink-0 text-xs text-dimmed">{{ plural(entry.sets.length, 'set') }}</span>
        </button>
      </div>
    </template>
    <template v-if="source" #footer>
      <UButton label="Start workout" block class="min-h-10" :disabled="!picked.length" data-test="copy-start" @click="startCopy" />
    </template>
  </AppSheet>
</template>
