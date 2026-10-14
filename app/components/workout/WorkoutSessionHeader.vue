<script setup lang="ts">
import { format } from 'date-fns'
import type { WorkoutSession } from '~~/shared/types/workout'
import { durationLabel, hasDuration } from '~~/shared/utils/workoutTime'

const props = defineProps<{ session: WorkoutSession }>()

const emit = defineEmits<{
  rename: [name: string | null]
}>()

const name = ref(props.session.name ?? '')
watch(
  () => props.session.name,
  (value) => {
    name.value = value ?? ''
  }
)

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
watch(
  () => props.session.endedAt,
  (endedAt) => {
    if (endedAt) stopTicker()
    else startTicker()
  }
)

const elapsedLabel = computed(() =>
  durationLabel(props.session.startedAt, props.session.endedAt ? new Date(props.session.endedAt).getTime() : now.value)
)

const dateLabel = computed(() => format(new Date(`${props.session.performedOn}T00:00:00`), 'EEE, MMM d'))
</script>

<template>
  <div class="flex flex-col gap-1" data-test="session-header">
    <div class="flex items-center gap-1">
      <UInput
        v-model="name"
        variant="ghost"
        placeholder="Workout name"
        aria-label="Workout name"
        class="min-w-0 flex-1"
        :ui="{ base: 'min-h-10 text-base font-semibold' }"
        data-test="session-name"
        @blur="saveName"
      />
      <span
        v-if="hasDuration(session.startedAt, session.endedAt)"
        class="shrink-0 text-sm tabular-nums text-dimmed"
        data-test="session-elapsed"
        >{{ elapsedLabel }}</span
      >
    </div>
    <div class="flex items-center gap-2 px-2.5 text-xs text-dimmed">
      <span data-test="session-date-label">{{ dateLabel }}</span>
      <span v-if="session.notes" class="truncate" data-test="session-notes">{{ session.notes }}</span>
    </div>
  </div>
</template>
