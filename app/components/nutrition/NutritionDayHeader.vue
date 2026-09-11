<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { formatDayTitle } from '~/utils/nutrition/dayTitle'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'

export type DayAction = 'copy-day' | 'select' | 'notes' | 'goal' | 'summary'

const props = defineProps<{ date: string }>()
const emit = defineEmits<{ navigate: [date: string], action: [action: DayAction] }>()

const pickerOpen = ref(false)
const pickerValue = ref(props.date)
watch(() => props.date, (value) => {
  pickerValue.value = value
})

function pick(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return
  pickerOpen.value = false
  emit('navigate', value)
}

const menu: DropdownMenuItem[][] = [
  [
    { label: 'Copy day', icon: 'i-lucide-copy', onSelect: () => emit('action', 'copy-day') },
    { label: 'Select entries', icon: 'i-lucide-list-checks', onSelect: () => emit('action', 'select') }
  ],
  [
    { label: 'Day notes', icon: 'i-lucide-notebook-pen', onSelect: () => emit('action', 'notes') },
    { label: 'Apply goal profile', icon: 'i-lucide-target', onSelect: () => emit('action', 'goal') }
  ],
  [{ label: 'Summary', icon: 'i-lucide-line-chart', onSelect: () => emit('action', 'summary') }]
]
</script>

<template>
  <UDashboardNavbar :ui="{ right: 'gap-1', title: 'min-w-0' }">
    <template #leading>
      <UDashboardSidebarCollapse />
    </template>
    <template #title>
      <div class="flex items-center gap-1 min-w-0">
        <UButton icon="i-lucide-chevron-left" aria-label="Previous day" variant="ghost" color="neutral" @click="emit('navigate', shiftDate(date, -1))" />
        <button type="button" class="font-semibold truncate px-1 min-w-0" data-test="diary-date" :data-date="date" @click="pickerOpen = true">
          {{ formatDayTitle(date) }}
        </button>
        <UButton icon="i-lucide-chevron-right" aria-label="Next day" variant="ghost" color="neutral" @click="emit('navigate', shiftDate(date, 1))" />
      </div>
    </template>
    <template #right>
      <UDropdownMenu :items="menu">
        <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Day actions" data-test="day-menu" />
      </UDropdownMenu>
    </template>
  </UDashboardNavbar>

  <NutritionSheet v-model:open="pickerOpen" title="Go to date">
    <template #body>
      <div class="flex flex-col gap-3">
        <input
          v-model="pickerValue"
          type="date"
          class="w-full rounded-md border border-default bg-default px-3 py-2"
          data-test="day-picker-input"
          @input="pick(pickerValue)"
        >
        <UButton label="Today" variant="soft" block data-test="day-picker-today" @click="pick(todayDate())" />
      </div>
    </template>
  </NutritionSheet>
</template>
