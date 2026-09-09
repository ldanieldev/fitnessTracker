<script setup lang="ts">
import { format } from 'date-fns'
import type { Range } from '~/types'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'

interface SummaryNutrient {
  key: string
  name: string
  unit: string
}

interface SummaryDay {
  date: string
  logged: boolean
  totals: Record<string, number | null>
  rolling: Record<string, number | null>
}

interface SummaryResponse {
  window: number
  nutrients: SummaryNutrient[]
  days: SummaryDay[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const route = useRoute()

const rangeEnd = todayDate()
const rangeStart = shiftDate(rangeEnd, -13)

function queryDate(value: unknown, fallback: string) {
  return typeof value === 'string' && DATE_RE.test(value) ? value : fallback
}

const range = ref<Range>({
  start: new Date(`${queryDate(route.query.from, rangeStart)}T00:00:00`),
  end: new Date(`${queryDate(route.query.to, rangeEnd)}T00:00:00`)
})
const windowSize = ref(7)

const windowItems = [
  { label: '3-day', value: 3 },
  { label: '7-day', value: 7 },
  { label: '14-day', value: 14 }
]

const from = computed(() => format(range.value.start, 'yyyy-MM-dd'))
const to = computed(() => format(range.value.end, 'yyyy-MM-dd'))

const { data: summary } = useFetch<SummaryResponse>(
  () => `/api/nutrition/diary/summary?from=${from.value}&to=${to.value}&window=${windowSize.value}`,
  { watch: [from, to, windowSize] }
)

const { tracked } = useTrackedNutrients()

const trackedNutrients = computed(() => {
  const byKey = new Map((summary.value?.nutrients ?? []).map((n) => [n.key, n]))
  return (tracked.value ?? []).map((t) => byKey.get(t.key) ?? t)
})

function formatValue(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : value.toFixed(1)
}

function totalCell(day: SummaryDay, key: string) {
  return day.logged ? formatValue(day.totals[key]) : '—'
}

function rollingCell(day: SummaryDay, key: string) {
  return formatValue(day.rolling[key])
}

function exportUrl(exportFormat: 'csv' | 'json') {
  return `/api/nutrition/diary/export?from=${from.value}&to=${to.value}&format=${exportFormat}`
}

function openExport(exportFormat: 'csv' | 'json') {
  window.open(exportUrl(exportFormat), '_blank')
}
</script>

<template>
  <UDashboardPanel id="diary-summary">
    <template #header>
      <UDashboardNavbar title="Summary" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <DashboardDateRangePicker v-model="range" />
          <USelect v-model="windowSize" :items="windowItems" data-test="summary-window" class="w-32" />
          <UButton
            label="Export CSV"
            icon="i-lucide-download"
            variant="soft"
            color="neutral"
            size="sm"
            data-test="export-csv"
            @click="openExport('csv')"
          />
          <UButton
            label="JSON"
            icon="i-lucide-download"
            variant="soft"
            color="neutral"
            size="sm"
            data-test="export-json"
            @click="openExport('json')"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="border-b border-default text-left text-dimmed">
              <th class="py-2 pr-4">Date</th>
              <th class="py-2 pr-4">Logged</th>
              <template v-for="nutrient in trackedNutrients" :key="nutrient.key">
                <th class="py-2 pr-4">{{ nutrient.name }} total</th>
                <th class="py-2 pr-4">{{ nutrient.name }} avg</th>
              </template>
            </tr>
          </thead>
          <tbody>
            <tr v-for="day in summary?.days ?? []" :key="day.date" class="border-b border-default" :data-test="`summary-row-${day.date}`">
              <td class="py-2 pr-4 font-medium">{{ day.date }}</td>
              <td class="py-2 pr-4">
                <UIcon v-if="day.logged" name="i-lucide-check" class="text-success size-4" />
                <span v-else class="text-dimmed">—</span>
              </td>
              <template v-for="nutrient in trackedNutrients" :key="nutrient.key">
                <td class="py-2 pr-4" :data-test="`summary-${nutrient.key}-total-${day.date}`">{{ totalCell(day, nutrient.key) }}</td>
                <td class="py-2 pr-4" :data-test="`summary-${nutrient.key}-avg-${day.date}`">{{ rollingCell(day, nutrient.key) }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UDashboardPanel>
</template>
