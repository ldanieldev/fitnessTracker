<script setup lang="ts">
import { NUTRITION_MACROS } from '~/constants/nutrition'
import { errorMessage } from '~/utils/apiError'
import type { DiaryEntry, DiaryTargetRow } from '~/composables/useDiaryDay'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'
import type { CopyOverride } from '~~/shared/utils/nutritionCopy'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MODE_STORAGE_KEY = 'nutrition.diary.mode'

const route = useRoute()
const rawParam = computed(() => String(route.params.date))

if (!DATE_RE.test(rawParam.value)) {
  await navigateTo(`/diary/${todayDate()}`, { replace: true })
}

const date = computed(() => (DATE_RE.test(rawParam.value) ? rawParam.value : todayDate()))

const toast = useToast()
const { day, refresh, deleteEntry } = useDiaryDay(date)
const { tracked } = useTrackedNutrients()

const mode = ref<'remaining' | 'consumed'>('remaining')

onMounted(() => {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY)
    if (stored === 'remaining' || stored === 'consumed') mode.value = stored
  } catch {
    mode.value = 'remaining'
  }
})

watch(mode, (value) => {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, value)
  } catch {
    // best-effort — private browsing or disabled storage should not break the toggle
  }
})

const modeItems = [
  { label: 'Remaining', value: 'remaining' as const },
  { label: 'Consumed', value: 'consumed' as const }
]

const targetRows = computed<DiaryTargetRow[]>(() => {
  const targets = day.value?.targets ?? []
  const byKey = new Map(targets.map((t) => [t.key, t]))
  return (tracked.value ?? []).map((nutrient) => {
    const target = byKey.get(nutrient.key)
    return target
      ? { key: target.key, name: target.name, unit: target.unit, amount: target.amount, direction: target.direction }
      : { key: nutrient.key, name: nutrient.name, unit: nutrient.unit, amount: null, direction: null }
  })
})

const subtotalNutrients = computed(() =>
  (tracked.value ?? []).map((n) => ({ key: n.key, name: n.name, unit: n.unit }))
)

const totalsDisplay = computed(() => {
  const totals = day.value?.totals ?? {}
  return NUTRITION_MACROS.map((macro) => ({ key: macro.key, name: macro.name, unit: macro.unit, value: totals[macro.key] ?? 0 }))
})

function goToOffset(offsetDays: number) {
  navigateTo(`/diary/${shiftDate(date.value, offsetDays)}`)
}

function goToToday() {
  navigateTo(`/diary/${todayDate()}`)
}

const selection = useEntrySelection()

watch(date, () => selection.clear())

const copyDialogOpen = ref(false)
const copySourceEntries = ref<DiaryEntry[]>([])

const copyContainers = computed(() => (day.value?.containers ?? []).map((c) => ({ id: c.id, name: c.name })))

function openCopyDialog(entries: DiaryEntry[]) {
  copySourceEntries.value = entries
  copyDialogOpen.value = true
}

function copyDay() {
  openCopyDialog(day.value?.entries ?? [])
}

function copyContainer(containerId: number) {
  const container = day.value?.containers.find((c) => c.id === containerId)
  if (container) openCopyDialog(container.entries)
}

function copyEntry(entryId: number) {
  const entry = day.value?.entries.find((e) => e.id === entryId)
  if (entry) openCopyDialog([entry])
}

function copySelected() {
  const entries = (day.value?.entries ?? []).filter((e) => selection.state.selected.has(e.id))
  if (entries.length) openCopyDialog(entries)
}

interface CopyConfirmPayload {
  sourceEntryIds: number[]
  targetDate: string
  targetContainerId: number | null
  overrides: CopyOverride[]
}

async function onCopyConfirm(payload: CopyConfirmPayload) {
  try {
    await $fetch('/api/nutrition/diary/copy', { method: 'POST', body: payload })
  } catch (error: unknown) {
    toast.add({ title: 'Copy failed', description: errorMessage(error, 'Could not copy these entries'), color: 'error' })
    return
  }
  copyDialogOpen.value = false
  selection.clear()
  if (payload.targetDate === date.value) {
    await refresh()
  } else {
    await navigateTo(`/diary/${payload.targetDate}`)
  }
}
</script>

<template>
  <UDashboardPanel id="diary">
    <template #header>
      <UDashboardNavbar :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #title>
          <span class="font-semibold">{{ date }}</span>
        </template>

        <template #right>
          <UButton
            icon="i-lucide-chevron-left"
            aria-label="Previous day"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="goToOffset(-1)"
          />
          <UButton label="Today" variant="soft" color="neutral" size="sm" @click="goToToday" />
          <UButton
            icon="i-lucide-chevron-right"
            aria-label="Next day"
            variant="ghost"
            color="neutral"
            size="sm"
            @click="goToOffset(1)"
          />
          <UButton
            icon="i-lucide-copy"
            label="Copy day"
            variant="soft"
            color="neutral"
            size="sm"
            data-test="copy-day"
            @click="copyDay"
          />
          <UButton
            icon="i-lucide-line-chart"
            label="Summary"
            variant="ghost"
            color="neutral"
            size="sm"
            to="/diary/summary"
            data-test="view-summary"
          />
          <UButton
            :label="selection.state.active ? 'Done' : 'Select'"
            variant="ghost"
            color="neutral"
            size="sm"
            data-test="toggle-select-mode"
            @click="selection.toggle()"
          />
          <UButton :to="`/diary/${date}/add`" icon="i-lucide-plus" label="Add food" size="sm" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 max-w-3xl mx-auto w-full pb-4">
        <UTabs v-model="mode" :items="modeItems" />

        <NutritionDayTargets v-if="day" :targets="targetRows" :totals="day.totals" :mode="mode" />

        <UCard>
          <template #header>
            <span class="font-medium">Totals</span>
          </template>
          <div class="flex gap-4 text-sm text-dimmed">
            <span v-for="total in totalsDisplay" :key="total.key" :data-test="`total-${total.key}`">
              {{ total.value.toFixed(1) }} {{ total.unit }}
            </span>
          </div>
        </UCard>

        <UButton
          v-if="selection.state.active"
          label="Copy selected"
          class="w-fit"
          :disabled="selection.state.selected.size === 0"
          data-test="copy-selected"
          @click="copySelected"
        />

        <NutritionContainerCard
          v-for="container in day?.containers ?? []"
          :key="container.id"
          :container="container"
          :nutrients="subtotalNutrients"
          :selectable="selection.state.active"
          :selected-ids="selection.state.selected"
          @delete-entry="deleteEntry"
          @copy-entry="copyEntry"
          @copy-container="copyContainer"
          @toggle-entry="selection.toggleEntry"
        />
      </div>

      <NutritionCopyDialog
        v-model:open="copyDialogOpen"
        :source-entries="copySourceEntries"
        :containers="copyContainers"
        :default-date="date"
        @confirm="onCopyConfirm"
      />
    </template>
  </UDashboardPanel>
</template>
