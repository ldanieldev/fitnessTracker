<script setup lang="ts">
import { format } from 'date-fns'
import type { MeasurementDirection, MeasurementEntry, MeasurementType } from '~~/shared/types/body'
import { deltaTone, formatDelta, formatValue } from '~~/shared/utils/bodyMetrics'

const props = defineProps<{ entries: MeasurementEntry[], type: MeasurementType, direction?: MeasurementDirection }>()
const emit = defineEmits<{ edit: [entry: MeasurementEntry] }>()

interface Row {
  entry: MeasurementEntry
  delta: number | null
}

interface Group {
  date: string
  label: string
  rows: Row[]
}

// Entries arrive newest first, so the chronologically previous reading is the next element.
const groups = computed<Group[]>(() => {
  const out: Group[] = []
  props.entries.forEach((entry, i) => {
    const prev = props.entries[i + 1]
    const row = { entry, delta: prev ? entry.value - prev.value : null }
    const last = out[out.length - 1]
    if (last && last.date === entry.measuredOn) last.rows.push(row)
    else out.push({ date: entry.measuredOn, label: format(new Date(`${entry.measuredOn}T00:00:00`), 'EEEE, MMMM d yyyy'), rows: [row] })
  })
  return out
})

const tone = (delta: number) => deltaTone(delta, props.direction ?? props.type.direction)
</script>

<template>
  <div class="flex flex-col gap-3" data-test="entry-list">
    <p v-if="entries.length === 0" class="text-sm text-dimmed">No readings in this range</p>
    <section v-for="group in groups" :key="group.date" class="flex flex-col gap-1">
      <h3 class="text-xs font-medium uppercase text-dimmed">{{ group.label }}</h3>
      <button
        v-for="row in group.rows"
        :key="row.entry.id"
        type="button"
        class="flex min-h-12 items-center gap-3 rounded-md px-2 py-1 text-left active:bg-accented"
        :data-test="`entry-row-${row.entry.id}`"
        @click="emit('edit', row.entry)"
      >
        <span class="flex-1 text-sm text-dimmed">{{ format(new Date(row.entry.measuredAt), 'h:mm a') }}</span>
        <span class="font-medium tabular-nums">
          {{ formatValue(row.entry.value, type.precision) }} <span class="text-xs text-muted">{{ type.unit }}</span>
        </span>
        <UBadge v-if="row.delta !== null" :color="tone(row.delta)" variant="subtle" class="tabular-nums">
          {{ formatDelta(row.delta, type.precision) }}
        </UBadge>
        <UIcon name="i-lucide-chevron-right" class="size-4 text-dimmed" />
      </button>
    </section>
  </div>
</template>
