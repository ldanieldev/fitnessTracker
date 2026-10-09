<script setup lang="ts">
import { CalendarDate, type DateValue } from '@internationalized/date'
import type { WorkoutSessionSummary } from '~~/shared/types/workout'
import { CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'
import { phaseColorClass } from '~~/shared/utils/programs'
import { calendarDots } from '~~/shared/utils/workoutCalendar'

const props = defineProps<{ sessions: WorkoutSessionSummary[] }>()
const month = defineModel<string>('month', { required: true })
const day = defineModel<string | null>('day', { default: null })
const { user } = useUserSession()
const weekStart = computed(() => user.value?.weekStart ?? 1)

const dots = computed(() => calendarDots(props.sessions))

const phasesByDay = computed(() => {
  const map = new Map<string, Array<{ phaseId: number, index: number, color: string }>>()
  for (const s of props.sessions) {
    const tag = s.program
    if (!tag) continue
    const marks = map.get(s.performedOn) ?? []
    if (!marks.some((m) => m.phaseId === tag.phaseId)) {
      marks.push({ phaseId: tag.phaseId, index: tag.phaseIndex, color: phaseColorClass(tag.phaseIndex) })
      marks.sort((a, b) => a.index - b.index)
    }
    map.set(s.performedOn, marks)
  }
  return map
})

function toCalendarDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new CalendarDate(y, m, d)
}

const placeholder = computed({
  get: () => toCalendarDate(`${month.value}-01`),
  set: (value: DateValue) => {
    month.value = `${value.year}-${String(value.month).padStart(2, '0')}`
  }
})

const selected = computed({
  get: () => (day.value ? toCalendarDate(day.value) : undefined),
  set: (value: DateValue | undefined) => {
    if (value) day.value = value.toString()
  }
})
</script>

<template>
  <UCalendar
    v-model="selected"
    v-model:placeholder="placeholder"
    :week-starts-on="weekStart"
    variant="subtle"
    class="w-full"
    :ui="{ cellTrigger: 'mx-auto h-11 w-10 flex-col gap-0.5 rounded-md' }"
    data-test="workout-calendar"
  >
    <template #day="{ day: cell }">
      <span class="flex flex-col items-center gap-0.5" :data-test="`calendar-day-${cell.toString()}`">
        <span>{{ cell.day }}</span>
        <span class="flex h-1.5 items-center gap-0.5">
          <span
            v-for="dot in dots.get(cell.toString())?.dots ?? []"
            :key="dot.id"
            class="size-1.5 rounded-full"
            :class="CATEGORY_DOT_CLASS[dot.color] ?? CATEGORY_DOT_CLASS.fallback"
            data-test="calendar-dot"
          />
          <span v-if="dots.get(cell.toString())?.more" class="text-[9px] leading-none" data-test="calendar-dot-more">+</span>
        </span>
        <span class="flex h-0.5 w-4 gap-px">
          <span
            v-for="mark in phasesByDay.get(cell.toString()) ?? []"
            :key="mark.phaseId"
            class="h-full flex-1 rounded-full"
            :class="mark.color"
            data-test="calendar-phase"
          />
        </span>
      </span>
    </template>
  </UCalendar>
</template>
