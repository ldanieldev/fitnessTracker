<script setup lang="ts">
import { format } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
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

const { data: summary, status: summaryStatus } = useNutritionFetch<SummaryResponse>(
  () => NUTRITION_KEYS.summary(from.value, to.value, windowSize.value),
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

const narrow = useIsNarrow()

const menu = computed<DropdownMenuItem[][]>(() => [
  windowItems.map((w) => ({
    label: `${w.label} average`,
    icon: windowSize.value === w.value ? 'i-lucide-check' : undefined,
    onSelect: () => { windowSize.value = w.value }
  })),
  [
    { label: 'Export CSV', icon: 'i-lucide-download', onSelect: () => openExport('csv') },
    { label: 'Export JSON', icon: 'i-lucide-download', onSelect: () => openExport('json') }
  ]
])
</script>

<template>
  <UDashboardPanel id="diary-summary">
    <template #header>
      <UDashboardNavbar title="Summary" :ui="{ right: 'gap-3 min-w-0' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <DashboardDateRangePicker v-model="range" :months="narrow ? 1 : 2" />
          <UDropdownMenu :items="menu">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Summary actions" data-test="summary-menu" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <NutritionListSkeleton v-if="summaryStatus === 'pending' && !summary" :rows="5" />
      <div v-else-if="narrow" class="flex flex-col gap-2">
        <div v-for="day in summary?.days ?? []" :key="day.date" :data-test="`summary-row-${day.date}`">
          <UCard data-test="summary-card">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="font-medium">{{ day.date }}</span>
              <UIcon v-if="day.logged" name="i-lucide-check" class="text-success size-4" />
              <span v-else class="text-dimmed">—</span>
            </div>
            <NutritionMacroText v-if="day.logged" with-energy :nutrients="day.totals" class="mb-2" />
            <div class="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-sm">
              <template v-for="nutrient in trackedNutrients" :key="nutrient.key">
                <span class="text-dimmed">{{ nutrient.name }}</span>
                <span :data-test="`summary-${nutrient.key}-total-${day.date}`">{{ totalCell(day, nutrient.key) }}</span>
                <span class="text-dimmed" :data-test="`summary-${nutrient.key}-avg-${day.date}`">{{ rollingCell(day, nutrient.key) }}</span>
              </template>
            </div>
          </UCard>
        </div>
      </div>
      <div v-else class="overflow-x-auto">
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
