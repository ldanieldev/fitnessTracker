<script setup lang="ts">
import type { PointerChoice } from '~~/shared/types/workout'
import type { Routine, RoutineDay, RoutineSummary } from '~~/shared/types/routine'
import { needsPointerChoice } from '~~/shared/utils/routineCycle'
import WorkoutPointerPrompt from '~/components/workout/WorkoutPointerPrompt.vue'
import { errorMessage } from '~/utils/apiError'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ start: [body: { routineDayId: number, pointer?: PointerChoice }] }>()
const toast = useToast()

const summaries = ref<RoutineSummary[]>([])
const routine = ref<Routine | null>(null)
const pending = ref<RoutineDay | null>(null)
const promptOpen = ref(false)

function fail(err: unknown, fallback: string) {
  toast.add({ title: 'Load failed', description: errorMessage(err, fallback), color: 'error' })
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  routine.value = null
  try {
    summaries.value = await apiFetch<RoutineSummary[]>('/api/workouts/routines')
  } catch (err: unknown) {
    fail(err, 'Could not load your routines')
  }
})

async function pickRoutine(id: number) {
  try {
    routine.value = await apiFetch<Routine>(`/api/workouts/routines/${id}`)
  } catch (err: unknown) {
    fail(err, 'Could not load this routine')
  }
}

const rotation = computed(() => routine.value?.days.filter((day) => !day.floating) ?? [])
const floating = computed(() => routine.value?.days.filter((day) => day.floating) ?? [])
const dueName = computed(() => routine.value?.days.find((day) => day.id === routine.value?.nextDayId)?.name ?? '')

function pickDay(day: RoutineDay) {
  const current = routine.value!
  open.value = false
  if (needsPointerChoice(current.days, current.nextDayId, day.id)) {
    pending.value = day
    nextTick(() => (promptOpen.value = true))
    return
  }
  emit('start', { routineDayId: day.id })
}

function choose(choice: PointerChoice) {
  if (pending.value) emit('start', { routineDayId: pending.value.id, pointer: choice })
}
</script>

<template>
  <AppSheet v-model:open="open" :title="routine ? routine.name : 'Pick a routine'">
    <template #body>
      <div v-if="!routine" class="flex flex-col gap-1">
        <p v-if="!summaries.length" class="text-sm text-dimmed">No routines yet — make one under Routines.</p>
        <button
          v-for="summary in summaries"
          :key="summary.id"
          type="button"
          class="flex min-h-10 flex-col rounded-lg px-2 py-2 text-left hover:bg-elevated"
          :disabled="!summary.dayCount"
          :data-test="`routine-pick-${summary.id}`"
          @click="pickRoutine(summary.id)"
        >
          <span class="truncate font-medium text-highlighted">{{ summary.name }}</span>
          <span class="truncate text-xs text-dimmed">{{ summary.dayCount }} {{ summary.dayCount === 1 ? 'day' : 'days' }}</span>
        </button>
      </div>
      <div v-else class="flex flex-col gap-1">
        <UButton label="All routines" icon="i-lucide-arrow-left" variant="ghost" color="neutral" class="min-h-10 self-start" data-test="day-picker-back" @click="routine = null" />
        <button
          v-for="day in rotation"
          :key="day.id"
          type="button"
          class="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left hover:bg-elevated"
          :data-test="`day-pick-${day.id}`"
          @click="pickDay(day)"
        >
          <span class="min-w-0 flex-1 truncate font-medium text-highlighted">{{ day.name }}</span>
          <UBadge v-if="day.id === routine.nextDayId" label="next" color="primary" variant="subtle" size="sm" data-test="day-next-badge" />
        </button>
        <USeparator v-if="floating.length" label="Floating" />
        <button
          v-for="day in floating"
          :key="day.id"
          type="button"
          class="flex min-h-10 items-center rounded-lg px-2 text-left hover:bg-elevated"
          :data-test="`day-pick-${day.id}`"
          @click="pickDay(day)"
        >
          <span class="truncate font-medium text-highlighted">{{ day.name }}</span>
        </button>
      </div>
    </template>
  </AppSheet>
  <WorkoutPointerPrompt v-model:open="promptOpen" :day-name="pending?.name ?? ''" :due-name="dueName" @choose="choose" />
</template>
