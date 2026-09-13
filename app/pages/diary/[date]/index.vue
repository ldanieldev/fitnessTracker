<script setup lang="ts">
import { errorMessage } from '~/utils/apiError'
import type { DiaryEntry } from '~/composables/useDiaryDay'
import type { CopyOverride } from '~~/shared/utils/nutritionCopy'
import type { DayAction } from '~/components/nutrition/NutritionDayHeader.vue'
import { weekOf } from '~/utils/nutrition/week'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MODE_STORAGE_KEY = 'nutrition.diary.mode'

const route = useRoute()
const rawParam = computed(() => String(route.params.date))

if (!DATE_RE.test(rawParam.value)) {
  await navigateTo('/diary/today', { replace: true })
}

// The redirect above aborts rendering for an invalid param, so this never needs a `todayDate()` fallback that would run during SSR.
const date = computed(() => rawParam.value)

const { user } = useUserSession()
const weekStart = computed<0 | 1>(() => user.value?.weekStart ?? 1)
const week = computed(() => weekOf(date.value, weekStart.value))
const weekStartDate = computed(() => week.value[0]!)
const weekEndDate = computed(() => week.value[6]!)
const { data: loggedWeek } = useNutritionFetch<{ dates: string[] }>(
  () => NUTRITION_KEYS.logged(weekStartDate.value),
  () => `/api/nutrition/diary/logged?from=${weekStartDate.value}&to=${weekEndDate.value}`
)

const toast = useToast()
const { day, profiles, updateEntry, deleteEntry, goalName, targets: targetRows, totals, subtotalNutrients, profilesFetch, dayFetch } = useDaySummary(date)
await profilesFetch

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

const selection = useEntrySelection()

watch(date, () => selection.clear())

const copyDialogOpen = ref(false)
const copySourceEntries = ref<DiaryEntry[]>([])

const copyContainers = computed(() => (day.value?.containers ?? []).map((c) => ({ id: c.id, name: c.name })))

const editingEntryId = ref<number | null>(null)
const editingEntry = computed(() => day.value?.entries.find((e) => e.id === editingEntryId.value) ?? null)
const entrySheetOpen = computed({
  get: () => editingEntryId.value !== null,
  set: (value) => {
    if (!value) editingEntryId.value = null
  }
})

const notesOpen = ref(false)
const goalOpen = ref(false)
const saveAs = ref<{ kind: 'recipe' | 'saved-meal', containerId: number } | null>(null)

const saveAsContainerName = computed(() =>
  day.value?.containers.find((c) => c.id === saveAs.value?.containerId)?.name ?? ''
)
const saveAsOpen = computed({
  get: () => saveAs.value !== null,
  set: (value) => {
    if (!value) saveAs.value = null
  }
})

function onSaveAs(containerId: number, kind: 'recipe' | 'saved-meal') {
  saveAs.value = { containerId, kind }
}

const anySheetOpen = computed(() =>
  copyDialogOpen.value || entrySheetOpen.value || notesOpen.value || goalOpen.value || saveAsOpen.value
)

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

function onDayAction(action: DayAction) {
  if (action === 'copy-day') copyDay()
  else if (action === 'select') selection.toggle()
  else if (action === 'summary') navigateTo('/diary/summary')
  else if (action === 'notes') notesOpen.value = true
  else if (action === 'goal') goalOpen.value = true
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
  await invalidateNutrition(NUTRITION_KEYS.day(date.value), NUTRITION_KEYS.day(payload.targetDate), 'nutrition:logged:')
  if (payload.targetDate !== date.value) {
    await navigateTo(`/diary/${payload.targetDate}`)
  }
}
</script>

<template>
  <UDashboardPanel id="diary">
    <template #header>
      <NutritionDayHeader :date="date" @navigate="(d) => navigateTo(`/diary/${d}`)" @action="onDayAction" />
      <NutritionWeekStrip :date="date" :logged="loggedWeek?.dates ?? []" :week-start="weekStart" @navigate="(d) => navigateTo(`/diary/${d}`)" />
    </template>

    <template #body>
      <div class="flex flex-col gap-4 max-w-3xl mx-auto w-full pb-24">
        <NutritionSummaryCard v-if="day" v-model:mode="mode" :targets="targetRows" :totals="totals" :goal-name="goalName" @apply-goal="goalOpen = true" />

        <NutritionListSkeleton v-if="dayFetch.status.value === 'pending' && !day" />
        <NutritionContainerCard
          v-for="container in day?.containers ?? []"
          :key="container.id"
          :container="container"
          :date="date"
          :nutrients="subtotalNutrients"
          :selectable="selection.state.active"
          :selected-ids="selection.state.selected"
          @open-entry="(id) => (editingEntryId = id)"
          @copy-container="copyContainer"
          @toggle-entry="selection.toggleEntry"
          @save-as="onSaveAs"
        />

        <button
          v-if="day?.notes"
          type="button"
          class="w-full rounded-lg border border-default bg-default px-4 py-3 text-left"
          data-test="day-notes-card"
          @click="notesOpen = true"
        >
          <p class="text-xs font-medium text-dimmed">Notes</p>
          <p class="whitespace-pre-wrap text-sm">{{ day.notes }}</p>
        </button>
      </div>

      <div v-if="selection.state.active" class="fixed inset-x-0 bottom-0 z-10 flex gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-default/95 border-t border-default lg:static lg:border-0 lg:bg-transparent">
        <UButton label="Done" variant="soft" color="neutral" data-test="toggle-select-mode" @click="selection.toggle()" />
        <UButton label="Copy selected" class="ml-auto" :disabled="selection.state.selected.size === 0" data-test="copy-selected" @click="copySelected" />
      </div>

      <UButton
        v-if="!selection.state.active && !anySheetOpen"
        icon="i-lucide-plus"
        size="xl"
        class="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 rounded-full shadow-lg"
        aria-label="Add food"
        :to="`/diary/${date}/add`"
        data-test="fab-add"
      />

      <LazyNutritionCopyDialog
        v-model:open="copyDialogOpen"
        :source-entries="copySourceEntries"
        :containers="copyContainers"
        :default-date="date"
        @confirm="onCopyConfirm"
      />

      <LazyNutritionEntrySheet
        v-model:open="entrySheetOpen"
        :entry="editingEntry"
        :containers="copyContainers"
        @save="(id, patch) => updateEntry(id, patch)"
        @delete="deleteEntry"
        @copy="copyEntry"
      />

      <LazyNutritionDayNotesSheet v-model:open="notesOpen" :date="date" :notes="day?.notes ?? null" />

      <LazyNutritionGoalSheet
        v-model:open="goalOpen"
        :date="date"
        :profiles="profiles ?? []"
        :current-id="day?.goalProfileId ?? null"
      />

      <LazyNutritionSaveMealSheet
        v-model:open="saveAsOpen"
        :kind="saveAs?.kind ?? 'recipe'"
        :date="date"
        :container-id="saveAs?.containerId ?? 0"
        :container-name="saveAsContainerName"
      />
    </template>
  </UDashboardPanel>
</template>
