<script setup lang="ts">
import { CalendarDate, getLocalTimeZone } from '@internationalized/date'
import { todayDate } from '~~/shared/utils/nutritionSummary'
import { useIsNarrow } from '~/composables/useIsNarrow'

const props = defineProps<{ date: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [date: string] }>()
const narrow = useIsNarrow()

const model = computed({
  get: () => {
    const [y, m, d] = props.date.split('-').map(Number)
    return new CalendarDate(y!, m!, d!)
  },
  set: (value: CalendarDate | null) => {
    if (!value) return
    const js = value.toDate(getLocalTimeZone())
    const iso = `${js.getFullYear()}-${String(js.getMonth() + 1).padStart(2, '0')}-${String(js.getDate()).padStart(2, '0')}`
    open.value = false
    emit('pick', iso)
  }
})

function today() {
  open.value = false
  emit('pick', todayDate())
}
</script>

<template>
  <NutritionSheet v-if="narrow" v-model:open="open" title="Go to date">
    <template #body>
      <div class="flex flex-col items-center gap-3">
        <UCalendar v-model="model" data-test="day-calendar" />
        <UButton label="Today" variant="soft" block data-test="day-picker-today" @click="today" />
      </div>
    </template>
  </NutritionSheet>
  <UPopover v-else v-model:open="open" :content="{ align: 'start' }">
    <slot />
    <template #content>
      <div class="flex flex-col gap-2 p-2">
        <UCalendar v-model="model" data-test="day-calendar" />
        <UButton label="Today" variant="soft" block data-test="day-picker-today" @click="today" />
      </div>
    </template>
  </UPopover>
</template>
