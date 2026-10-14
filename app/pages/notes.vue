<script setup lang="ts">
import type { DayNote } from '~~/shared/types/days'
import { formatDayLabel } from '~~/shared/utils/dayLabel'
import { shiftDate } from '~~/shared/utils/nutritionSummary'

const PAGE = 50

const today = useTodayOrNow()
const notes = ref<DayNote[]>([])
const more = ref(false)
const loadingMore = ref(false)

const { data, refresh } = await useFetch<DayNote[]>('/api/days/notes', {
  key: 'days:notes',
  query: { limit: PAGE }
})
watch(
  data,
  (rows) => {
    notes.value = rows ?? []
    more.value = (rows?.length ?? 0) === PAGE
  },
  { immediate: true }
)

async function loadMore() {
  const last = notes.value[notes.value.length - 1]
  if (!last || loadingMore.value) return
  loadingMore.value = true
  try {
    const rows = await apiFetch<DayNote[]>('/api/days/notes', { query: { limit: PAGE, to: shiftDate(last.date, -1) } })
    notes.value = [...notes.value, ...rows]
    more.value = rows.length === PAGE
  } finally {
    loadingMore.value = false
  }
}

const newDate = ref(today.value)
const editing = ref<{ date: string; note: string | null } | null>(null)
const sheetOpen = computed({
  get: () => editing.value !== null,
  set: (value) => {
    if (!value) editing.value = null
  }
})

function edit(date: string) {
  editing.value = { date, note: notes.value.find((n) => n.date === date)?.note ?? null }
}

async function onSaved() {
  await refresh()
}
</script>

<template>
  <UDashboardPanel id="notes">
    <template #header>
      <AppNavbar title="Day notes" />
    </template>
    <template #body>
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div class="flex items-end gap-2">
          <UFormField label="Day" name="noteDate" class="min-w-0 flex-1 sm:flex-none">
            <UInput v-model="newDate" type="date" :max="today" class="w-full" data-test="notes-date" />
          </UFormField>
          <UButton
            label="Write note"
            icon="i-lucide-notebook-pen"
            :disabled="!newDate"
            data-test="notes-write"
            @click="edit(newDate)"
          />
        </div>

        <p v-if="notes.length === 0" class="text-sm text-dimmed" data-test="notes-empty">
          No notes yet. A note is for anything that explains a day's numbers: an event, a logging mistake, a missed
          workout, poor sleep.
        </p>

        <ul v-else class="flex flex-col gap-2">
          <li v-for="item in notes" :key="item.date">
            <button
              type="button"
              class="
                w-full cursor-pointer rounded-lg border border-default bg-default px-4 py-3 text-left hover:bg-elevated
              "
              :data-test="`note-${item.date}`"
              @click="edit(item.date)"
            >
              <p class="text-xs font-medium text-dimmed">{{ formatDayLabel(item.date) }}</p>
              <p class="whitespace-pre-wrap text-sm">{{ item.note }}</p>
            </button>
          </li>
        </ul>

        <UButton
          v-if="more"
          label="Load more"
          variant="soft"
          color="neutral"
          class="self-center"
          :loading="loadingMore"
          data-test="notes-more"
          @click="loadMore"
        />
      </div>
      <AppDayNoteSheet
        v-if="editing"
        v-model:open="sheetOpen"
        :date="editing.date"
        :note="editing.note"
        @saved="onSaved"
      />
    </template>
  </UDashboardPanel>
</template>
