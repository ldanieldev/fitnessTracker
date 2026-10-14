<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { formatMonthTitle } from '~/utils/nutrition/week'
import { useIsNarrow } from '~/composables/useIsNarrow'

export type DayAction = 'copy-day' | 'select' | 'notes' | 'goal' | 'summary' | 'incomplete'

const props = defineProps<{ date: string; incomplete?: boolean }>()
const emit = defineEmits<{ navigate: [date: string]; action: [action: DayAction] }>()

const pickerOpen = ref(false)
const narrow = useIsNarrow()

const menu = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Copy day', icon: 'i-lucide-copy', onSelect: () => emit('action', 'copy-day') },
    { label: 'Select entries', icon: 'i-lucide-list-checks', onSelect: () => emit('action', 'select') }
  ],
  [
    { label: 'Day notes', icon: 'i-lucide-notebook-pen', onSelect: () => emit('action', 'notes') },
    { label: 'Apply goal profile', icon: 'i-lucide-target', onSelect: () => emit('action', 'goal') },
    {
      label: props.incomplete ? 'Mark day complete' : 'Mark day incomplete',
      icon: props.incomplete ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed',
      onSelect: () => emit('action', 'incomplete')
    }
  ],
  [{ label: 'Summary', icon: 'i-lucide-line-chart', onSelect: () => emit('action', 'summary') }]
])
</script>

<template>
  <AppNavbar :ui="{ right: 'gap-1', title: 'min-w-0' }">
    <template #title>
      <NutritionDatePicker v-if="!narrow" v-model:open="pickerOpen" :date="date" @pick="(d) => emit('navigate', d)">
        <button type="button" class="font-semibold truncate px-1 min-w-0" data-test="diary-date" :data-date="date">
          {{ formatMonthTitle(date) }}
        </button>
      </NutritionDatePicker>
      <button
        v-else
        type="button"
        class="font-semibold truncate px-1 min-w-0"
        data-test="diary-date"
        :data-date="date"
        @click="pickerOpen = true"
      >
        {{ formatMonthTitle(date) }}
      </button>
    </template>
    <template #right>
      <AppMenuButton :items="menu" label="Day actions" test-id="day-menu" />
    </template>
  </AppNavbar>

  <NutritionDatePicker v-if="narrow" v-model:open="pickerOpen" :date="date" @pick="(d) => emit('navigate', d)" />
</template>
