<script setup lang="ts">
import type { PointerChoice } from '~~/shared/types/workout'
import type { Routine, RoutineDay, RoutineEntry, RoutineEntryPatch } from '~~/shared/types/routine'
import { needsPointerChoice } from '~~/shared/utils/routineCycle'
import WorkoutRoutineDayCard from '~/components/workout/WorkoutRoutineDayCard.vue'
import WorkoutRoutineDaySheet from '~/components/workout/WorkoutRoutineDaySheet.vue'
import WorkoutRoutineEntrySheet from '~/components/workout/WorkoutRoutineEntrySheet.vue'
import WorkoutSupersetSheet from '~/components/workout/WorkoutSupersetSheet.vue'
import WorkoutPointerPrompt from '~/components/workout/WorkoutPointerPrompt.vue'
import WorkoutExercisePicker from '~/components/workout/WorkoutExercisePicker.vue'
import { errorMessage } from '~/utils/apiError'

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()
const { start } = useWorkoutStart()

const { data: routine, error } = await useWorkoutFetch<Routine>(WORKOUT_KEYS.routine(id), `/api/workouts/routines/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Routine not found', fatal: true })

async function act(action: () => Promise<Routine>, fallback: string) {
  try {
    routine.value = await action()
    await invalidateWorkouts(WORKOUT_KEYS.routines)
  } catch (err: unknown) {
    toast.add({
      title: 'Update failed',
      description: errorMessage(err, fallback),
      color: 'error',
      actions: [{ label: 'Retry', onClick: () => { act(action, fallback) } }]
    })
  }
}

const call = (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: object) =>
  () => apiFetch<Routine>(`/api/workouts/${path}`, { method, body })

const rotation = computed(() => routine.value?.days.filter((day) => !day.floating) ?? [])
const floating = computed(() => routine.value?.days.filter((day) => day.floating) ?? [])

function dayIndex(day: RoutineDay) {
  return routine.value!.days.findIndex((candidate) => candidate.id === day.id)
}

function sectionNeighbour(day: RoutineDay, delta: -1 | 1): RoutineDay | null {
  const section = day.floating ? floating.value : rotation.value
  return section[section.findIndex((candidate) => candidate.id === day.id) + delta] ?? null
}

function moveDay(day: RoutineDay, delta: -1 | 1) {
  const neighbour = sectionNeighbour(day, delta)
  if (neighbour) act(call('PATCH', `routine-days/${day.id}`, { sortOrder: dayIndex(neighbour) }), 'Could not move this day')
}

const daySheetOpen = ref(false)
const editingDay = ref<RoutineDay | null>(null)
function openDaySheet(day: RoutineDay | null) {
  editingDay.value = day
  daySheetOpen.value = true
}
function saveDay(values: { name: string, description: string | null, floating: boolean }) {
  const day = editingDay.value
  if (day) act(call('PATCH', `routine-days/${day.id}`, values), 'Could not save this day')
  else act(call('POST', `routines/${id}/days`, { name: values.name, floating: values.floating }), 'Could not add this day')
}

const pickerOpen = ref(false)
const pickerDayId = ref<number | null>(null)
function openPicker(day: RoutineDay) {
  pickerDayId.value = day.id
  pickerOpen.value = true
}
function addExercise(exerciseId: number) {
  if (pickerDayId.value !== null) act(call('POST', `routine-days/${pickerDayId.value}/entries`, { exerciseId }), 'Could not add this exercise')
}

const entrySheetOpen = ref(false)
const editingEntry = ref<RoutineEntry | null>(null)
function openEntry(entry: RoutineEntry) {
  editingEntry.value = entry
  entrySheetOpen.value = true
}
function patchEntry(entryId: number, patch: RoutineEntryPatch) {
  return act(call('PATCH', `routine-entries/${entryId}`, patch), 'Could not save this exercise')
}

const supersetOpen = ref(false)
const supersetAnchor = ref<{ day: RoutineDay, entry: RoutineEntry } | null>(null)
const supersetOptions = computed(() => {
  const anchor = supersetAnchor.value
  if (!anchor) return []
  const day = routine.value?.days.find((candidate) => candidate.id === anchor.day.id)
  return (day?.entries ?? []).filter((entry) => entry.id !== anchor.entry.id).map((entry) => ({ id: entry.id, name: entry.exerciseName }))
})
function openSuperset(day: RoutineDay, entry: RoutineEntry) {
  supersetAnchor.value = { day, entry }
  supersetOpen.value = true
}
function groupWith(ids: number[]) {
  const anchor = supersetAnchor.value
  if (anchor) act(call('POST', `routine-days/${anchor.day.id}/group`, { entryIds: [anchor.entry.id, ...ids] }), 'Could not make this superset')
}

const promptOpen = ref(false)
const pendingDay = ref<RoutineDay | null>(null)
const dueName = computed(() => routine.value?.days.find((day) => day.id === routine.value?.nextDayId)?.name ?? '')

async function begin(day: RoutineDay, pointer?: PointerChoice) {
  const session = await start({ routineDayId: day.id, pointer })
  if (session) await navigateTo('/workouts/log')
}
function startDay(day: RoutineDay) {
  if (needsPointerChoice(routine.value!.days, routine.value!.nextDayId, day.id)) {
    pendingDay.value = day
    promptOpen.value = true
    return
  }
  begin(day)
}
function choosePointer(choice: PointerChoice) {
  if (pendingDay.value) begin(pendingDay.value, choice)
}

const confirmDeleteOpen = ref(false)
const deletingDay = ref<RoutineDay | null>(null)
function askDeleteDay(day: RoutineDay) {
  deletingDay.value = day
  confirmDeleteOpen.value = true
}
function deleteDay() {
  confirmDeleteOpen.value = false
  if (deletingDay.value) act(call('DELETE', `routine-days/${deletingDay.value.id}`), 'Could not delete this day')
}
</script>

<template>
  <UDashboardPanel id="workout-routine">
    <template #header>
      <UDashboardNavbar :title="routine?.name ?? 'Routine'">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Back to routines" to="/workouts/routines" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="routine" class="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-4">
        <div class="flex items-center gap-3">
          <UInput
            :model-value="routine.name"
            class="min-w-0 flex-1"
            :maxlength="255"
            aria-label="Routine name"
            data-test="routine-name"
            @change="(event: Event) => { const name = (event.target as HTMLInputElement).value.trim(); if (name && name !== routine!.name) act(call('PATCH', `routines/${id}`, { name }), 'Could not rename this routine') }"
          />
          <USwitch
            :model-value="routine.active"
            label="Active"
            :disabled="!routine.days.length"
            data-test="routine-active"
            @update:model-value="(active: boolean) => act(call('PATCH', `routines/${id}`, { active }), 'Could not change the active routine')"
          />
        </div>
        <UTextarea
          :model-value="routine.notes ?? ''"
          :rows="2"
          :maxlength="2000"
          autoresize
          placeholder="Notes"
          aria-label="Routine notes"
          data-test="routine-notes"
          @change="(event: Event) => act(call('PATCH', `routines/${id}`, { notes: (event.target as HTMLTextAreaElement).value.trim() || null }), 'Could not save the notes')"
        />

        <WorkoutRoutineDayCard
          v-for="day in rotation"
          :key="day.id"
          :day="day"
          :is-due="day.id === routine.nextDayId"
          :can-move-up="!!sectionNeighbour(day, -1)"
          :can-move-down="!!sectionNeighbour(day, 1)"
          @edit="openDaySheet(day)"
          @make-next="act(call('PATCH', `routines/${id}`, { nextDayId: day.id }), 'Could not make this day next')"
          @move="(delta) => moveDay(day, delta)"
          @remove="askDeleteDay(day)"
          @skip="act(call('POST', `routines/${id}/skip`), 'Could not skip this day')"
          @start="startDay(day)"
          @add-exercise="openPicker(day)"
          @edit-entry="openEntry"
          @move-entry="(entry, delta) => patchEntry(entry.id, { sortOrder: entry.sortOrder + delta })"
          @superset-entry="(entry) => openSuperset(day, entry)"
          @ungroup-entry="(entry) => patchEntry(entry.id, { supersetGroup: null })"
        />

        <USeparator v-if="floating.length" label="Floating" />
        <WorkoutRoutineDayCard
          v-for="day in floating"
          :key="day.id"
          :day="day"
          :is-due="false"
          :can-move-up="!!sectionNeighbour(day, -1)"
          :can-move-down="!!sectionNeighbour(day, 1)"
          @edit="openDaySheet(day)"
          @move="(delta) => moveDay(day, delta)"
          @remove="askDeleteDay(day)"
          @start="startDay(day)"
          @add-exercise="openPicker(day)"
          @edit-entry="openEntry"
          @move-entry="(entry, delta) => patchEntry(entry.id, { sortOrder: entry.sortOrder + delta })"
          @superset-entry="(entry) => openSuperset(day, entry)"
          @ungroup-entry="(entry) => patchEntry(entry.id, { supersetGroup: null })"
        />

        <UButton label="Add day" icon="i-lucide-plus" variant="soft" color="neutral" block class="min-h-10" data-test="routine-day-add" @click="openDaySheet(null)" />
      </div>

      <WorkoutRoutineDaySheet v-model:open="daySheetOpen" :day="editingDay" @save="saveDay" />
      <WorkoutRoutineEntrySheet
        v-model:open="entrySheetOpen"
        :entry="editingEntry"
        @save="(patch) => editingEntry && patchEntry(editingEntry.id, patch)"
        @remove="editingEntry && act(call('DELETE', `routine-entries/${editingEntry.id}`), 'Could not remove this exercise')"
      />
      <WorkoutSupersetSheet v-model:open="supersetOpen" :options="supersetOptions" @group="groupWith" />
      <WorkoutExercisePicker v-model:open="pickerOpen" @pick="addExercise" />
      <WorkoutPointerPrompt v-model:open="promptOpen" :day-name="pendingDay?.name ?? ''" :due-name="dueName" @choose="choosePointer" />

      <UModal v-model:open="confirmDeleteOpen" :title="`Delete ${deletingDay?.name ?? 'day'}?`" description="Its exercises are removed from the routine. Logged workouts stay." :ui="{ footer: 'justify-end' }">
        <template #footer>
          <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="confirmDeleteOpen = false" />
          <UButton label="Delete" color="error" class="min-h-10" data-test="routine-day-delete-confirm" @click="deleteDay" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
