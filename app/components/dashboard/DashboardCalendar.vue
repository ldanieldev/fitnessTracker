<script setup lang="ts">
import { format } from 'date-fns'
import type { CalendarColumn, CalendarDay } from '~~/shared/types/dashboard'

const props = defineProps<{
  columns: CalendarColumn[]
  days: string[]
  today: string
  fill?: string
  weekBars?: (boolean | null)[]
  loading?: boolean
}>()

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const hits = computed(() => new Set(props.loading ? [] : props.days))
const bars = computed(() => (props.loading && props.weekBars ? props.columns.map(() => null) : props.weekBars))
const label = computed(() => {
  if (props.loading) return 'Loading'
  const past = props.columns.flatMap((c) => c.days.filter((d) => !d.future))
  return `${past.filter((d) => hits.value.has(d.date)).length} of ${past.length} days`
})
const template = computed(() => `0.75rem repeat(${props.columns.length}, minmax(0, 1fr))`)

type Align = 'start' | 'center' | 'end'
const ALIGN: Record<Align, string> = { start: '', center: '-translate-x-1/2', end: '-translate-x-full' }

const grid = useTemplateRef<HTMLElement>('grid')
const tip = ref<{ date: string; x: number; y: number; align: Align } | null>(null)

function showFor(event: PointerEvent, toggle: boolean) {
  if (!grid.value) return
  const cell = (event.target as HTMLElement).closest<HTMLElement>('[data-day]')
  const date = cell?.dataset.day
  if (!cell || !date || props.loading || cell.dataset.future === 'true' || (toggle && tip.value?.date === date)) {
    tip.value = null
    return
  }
  if (tip.value?.date === date) return
  const box = grid.value.getBoundingClientRect()
  const c = cell.getBoundingClientRect()
  const centre = c.left - box.left + c.width / 2
  const align: Align = centre < box.width / 4 ? 'start' : centre > (box.width * 3) / 4 ? 'end' : 'center'
  const x = align === 'start' ? c.left - box.left : align === 'end' ? c.right - box.left : centre
  tip.value = { date, x, y: c.top - box.top, align }
}

// Touch screens never show hover tooltips, so touch toggles the bubble on tap while a mouse shows it on hover.
const onTap = (event: PointerEvent) => event.pointerType !== 'mouse' && showFor(event, true)
const onHover = (event: PointerEvent) => event.pointerType === 'mouse' && showFor(event, false)
const onLeave = (event: PointerEvent) => {
  if (event.pointerType === 'mouse') tip.value = null
}

function closeOutside(event: PointerEvent) {
  if (!grid.value?.contains(event.target as Node)) tip.value = null
}
watch(tip, (open, was) => {
  if (open && !was) document.addEventListener('pointerdown', closeOutside)
  if (!open) document.removeEventListener('pointerdown', closeOutside)
})
watch(() => props.loading, () => (tip.value = null))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))

function weekdayLetter(row: number): string {
  const first = props.columns[0]?.days[row]?.date
  return first ? LETTERS[new Date(`${first}T00:00:00Z`).getUTCDay()]! : ''
}

function cellClass(day: CalendarDay) {
  if (day.future) return 'invisible'
  if (props.loading) return 'animate-pulse bg-accented'
  return [
    hits.value.has(day.date) ? props.fill : 'bg-accented',
    day.date === props.today && 'ring-1 ring-(--ui-text-dimmed)'
  ]
}
</script>

<template>
  <div
    ref="grid"
    class="relative mx-auto grid w-full max-w-sm gap-[3px]"
    :style="{ gridTemplateColumns: template }"
    role="img"
    :aria-label="label"
    data-test="calendar"
    @pointerup="onTap"
    @pointerover="onHover"
    @pointerleave="onLeave"
  >
    <span aria-hidden="true" />
    <span
      v-for="column in columns"
      :key="`m-${column.start}`"
      class="h-3 text-[10px] leading-3 whitespace-nowrap text-dimmed"
      aria-hidden="true"
      data-test="calendar-month"
    >{{ column.month ?? '' }}</span>
    <template v-for="row in 7" :key="`r-${row}`">
      <span class="self-center text-[9px] leading-none text-dimmed" aria-hidden="true">{{
        row % 2 === 0 ? weekdayLetter(row - 1) : ''
      }}</span>
      <span
        v-for="column in columns"
        :key="column.days[row - 1]!.date"
        class="aspect-square rounded-[3px]"
        :class="cellClass(column.days[row - 1]!)"
        aria-hidden="true"
        :data-day="column.days[row - 1]!.date"
        :data-hit="hits.has(column.days[row - 1]!.date)"
        :data-today="column.days[row - 1]!.date === today"
        :data-future="column.days[row - 1]!.future"
      />
    </template>
    <template v-if="bars">
      <span aria-hidden="true" />
      <span
        v-for="(met, index) in bars"
        :key="`b-${index}`"
        class="h-[3px] rounded-sm"
        aria-hidden="true"
        :class="met === true ? 'bg-green-500' : met === false ? 'bg-accented' : ''"
        :data-met="String(met)"
      />
    </template>
    <span
      v-if="tip"
      class="pointer-events-none absolute z-10 -mt-1.5 -translate-y-full rounded-md bg-inverted px-2 py-1 text-xs"
      :class="['whitespace-nowrap text-inverted shadow', ALIGN[tip.align]]"
      :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
      data-test="calendar-tip"
    >{{ format(new Date(`${tip.date}T00:00:00`), 'EEE, MMM d') }}</span>
  </div>
</template>
