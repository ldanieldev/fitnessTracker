<script setup lang="ts">
import { weekOf, shiftWeek } from '~/utils/nutrition/week'

const props = defineProps<{ date: string, logged: string[], weekStart: 0 | 1 }>()
const emit = defineEmits<{ navigate: [date: string] }>()

const today = useToday()
const days = computed(() => weekOf(props.date, props.weekStart))
const loggedSet = computed(() => new Set(props.logged))
const DOW = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const dayLabel = (d: string) => DOW.format(new Date(`${d}T00:00:00`))
const dayNumber = (d: string) => Number(d.slice(8, 10))

function move(weeks: 1 | -1) {
  emit('navigate', shiftWeek(props.date, weeks))
}

let startX: number | null = null
function onPointerDown(e: PointerEvent) {
  startX = e.clientX
}
function onPointerUp(e: PointerEvent) {
  if (startX === null) return
  const dx = e.clientX - startX
  startX = null
  if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1)
}
</script>

<template>
  <div class="flex items-center gap-1 select-none touch-pan-y" @pointerdown="onPointerDown" @pointerup="onPointerUp" @pointercancel="startX = null">
    <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" size="xs" class="hidden sm:inline-flex" aria-label="Previous week" data-test="week-prev" @click="move(-1)" />
    <div class="grid flex-1 grid-cols-7 gap-1">
      <button
        v-for="d in days"
        :key="d"
        type="button"
        class="flex flex-col items-center rounded-xl py-1.5 text-[11px] leading-tight"
        :class="d === date ? 'bg-primary text-white' : 'text-dimmed active:bg-accented'"
        :aria-current="d === date ? 'date' : undefined"
        :data-test="`week-day-${d}`"
        @click="emit('navigate', d)"
      >
        <span>{{ dayLabel(d) }}</span>
        <span class="text-[15px] font-semibold" :class="d === date ? 'text-white' : 'text-highlighted'">{{ dayNumber(d) }}</span>
        <span class="mt-0.5 size-1 rounded-full" :class="loggedSet.has(d) ? 'bg-protein' : 'bg-transparent'" :data-test="loggedSet.has(d) ? 'logged-dot' : undefined" />
        <span v-if="d === today" class="sr-only">today</span>
      </button>
    </div>
    <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" size="xs" class="hidden sm:inline-flex" aria-label="Next week" data-test="week-next" @click="move(1)" />
  </div>
</template>
