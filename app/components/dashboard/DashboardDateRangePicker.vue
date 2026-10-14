<script setup lang="ts">
import { CalendarDate, getLocalTimeZone, toCalendarDate as toDay, today, type DateValue } from '@internationalized/date'
import type { Range } from '~/types'
import { formatRange } from '~/utils/dateRange'

const selected = defineModel<Range>({ required: true })
const props = withDefaults(defineProps<{ months?: number }>(), { months: 2 })
const { user } = useUserSession()
const weekStart = computed(() => user.value?.weekStart ?? 1)

const ranges = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
  { label: 'Last year', years: 1 }
]

const toCalendarDate = (date: Date) => {
  return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

type CalendarRange = { start: DateValue | undefined; end: DateValue | undefined }

const fromSelected = (): CalendarRange => ({
  start: toCalendarDate(selected.value.start),
  end: toCalendarDate(selected.value.end)
})

// The calendar reports the first click as a range with no end, so it waits here until the second click completes it.
const calendarRange = shallowRef<CalendarRange>(fromSelected())
watch(selected, () => {
  calendarRange.value = fromSelected()
})

function onCalendarChange(value: CalendarRange | null) {
  calendarRange.value = value ?? { start: undefined, end: undefined }
  if (value?.start && value.end) {
    const tz = getLocalTimeZone()
    selected.value = { start: toDay(value.start).toDate(tz), end: toDay(value.end).toDate(tz) }
  }
}

function onOpenChange(open: boolean) {
  if (!open) calendarRange.value = fromSelected()
}

const isRangeSelected = (range: { days?: number; months?: number; years?: number }) => {
  if (!selected.value.start || !selected.value.end) return false

  const currentDate = today(getLocalTimeZone())
  let startDate = currentDate.copy()

  if (range.days) {
    startDate = startDate.subtract({ days: range.days })
  } else if (range.months) {
    startDate = startDate.subtract({ months: range.months })
  } else if (range.years) {
    startDate = startDate.subtract({ years: range.years })
  }

  const selectedStart = toCalendarDate(selected.value.start)
  const selectedEnd = toCalendarDate(selected.value.end)

  return selectedStart.compare(startDate) === 0 && selectedEnd.compare(currentDate) === 0
}

const selectRange = (range: { days?: number; months?: number; years?: number }) => {
  const endDate = today(getLocalTimeZone())
  let startDate = endDate.copy()

  if (range.days) {
    startDate = startDate.subtract({ days: range.days })
  } else if (range.months) {
    startDate = startDate.subtract({ months: range.months })
  } else if (range.years) {
    startDate = startDate.subtract({ years: range.years })
  }

  selected.value = {
    start: startDate.toDate(getLocalTimeZone()),
    end: endDate.toDate(getLocalTimeZone())
  }
}
</script>

<template>
  <UPopover :content="{ align: 'start' }" :modal="true" @update:open="onOpenChange">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-calendar"
      class="data-[state=open]:bg-elevated group min-w-0 max-w-[55vw] sm:max-w-none truncate"
    >
      <span class="truncate">
        <template v-if="selected.start">
          {{ formatRange(selected.start, selected.end, new Date()) }}
        </template>
        <template v-else> Pick a date </template>
      </span>

      <template #trailing>
        <UIcon
          name="i-lucide-chevron-down"
          class="shrink-0 text-dimmed size-5 group-data-[state=open]:rotate-180 transition-transform duration-200"
        />
      </template>
    </UButton>

    <template #content>
      <div class="flex items-stretch sm:divide-x divide-default">
        <div class="hidden sm:flex flex-col justify-center">
          <UButton
            v-for="(range, index) in ranges"
            :key="index"
            :label="range.label"
            color="neutral"
            variant="ghost"
            class="rounded-none px-4"
            :class="[isRangeSelected(range) ? 'bg-elevated' : 'hover:bg-elevated/50']"
            truncate
            @click="selectRange(range)"
          />
        </div>

        <UCalendar
          :model-value="calendarRange"
          class="p-2"
          :max-value="today(getLocalTimeZone())"
          :number-of-months="props.months"
          :week-starts-on="weekStart"
          range
          @update:model-value="onCalendarChange"
        />
      </div>
    </template>
  </UPopover>
</template>
