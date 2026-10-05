<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Program, ProgramPhase, StartWhen } from '~~/shared/types/program'
import type { RoutineSummary } from '~~/shared/types/routine'
import { phaseColorClass } from '~~/shared/utils/programs'
import WorkoutProgramPhaseSheet, { type PhaseValues } from '~/components/workout/WorkoutProgramPhaseSheet.vue'
import WorkoutProgramReplacePrompt from '~/components/workout/WorkoutProgramReplacePrompt.vue'
import WorkoutProgramWhenSheet from '~/components/workout/WorkoutProgramWhenSheet.vue'
import { errorCode, errorMessage } from '~/utils/apiError'

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()

const { data: program, error } = await useWorkoutFetch<Program>(WORKOUT_KEYS.program(id), `/api/workouts/programs/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: 'Program not found', fatal: true })
const { data: routineList } = useWorkoutFetch<RoutineSummary[]>(WORKOUT_KEYS.routines, '/api/workouts/routines', { lazy: true })
const { enrollment, today, enroll } = useEnrollment()
const running = computed(() => enrollment.value?.program.id === id && enrollment.value.state !== 'finished')

async function act(action: () => Promise<Program>, title: string, fallback: string): Promise<boolean> {
  try {
    program.value = await action()
    await invalidateWorkouts(WORKOUT_KEYS.programs, WORKOUT_KEYS.enrollment)
    return true
  } catch (err: unknown) {
    toast.add({ title, description: errorMessage(err, fallback), color: 'error' })
    return false
  }
}
const call = (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: object) =>
  () => apiFetch<Program>(`/api/workouts/${path}`, { method, body })

const nameDraft = ref(program.value?.name ?? '')
const descriptionDraft = ref(program.value?.description ?? '')
watch(() => program.value?.name, (name) => {
  nameDraft.value = name ?? ''
})
watch(() => program.value?.description, (description) => {
  descriptionDraft.value = description ?? ''
})
async function saveName() {
  const name = nameDraft.value.trim()
  const saved = program.value!.name
  if (name && name !== saved && await act(call('PATCH', `programs/${id}`, { name }), 'Couldn\'t save program', 'Could not rename this program')) return
  nameDraft.value = saved
}
async function saveDescription() {
  const description = descriptionDraft.value.trim() || null
  const saved = program.value!.description
  if (await act(call('PATCH', `programs/${id}`, { description }), 'Couldn\'t save program', 'Could not save the description')) {
    descriptionDraft.value = description ?? ''
    return
  }
  descriptionDraft.value = saved ?? ''
}

const sheetOpen = ref(false)
const editing = ref<ProgramPhase | null>(null)
function openPhase(phase: ProgramPhase | null) {
  editing.value = phase
  sheetOpen.value = true
}
function savePhase(values: PhaseValues) {
  const phase = editing.value
  if (phase) act(call('PATCH', `program-phases/${phase.id}`, values), 'Couldn\'t save phase', 'Could not save this phase')
  else act(call('POST', `programs/${id}/phases`, values), 'Couldn\'t save phase', 'Could not add this phase')
}
function movePhase(phase: ProgramPhase, delta: -1 | 1) {
  act(call('PATCH', `program-phases/${phase.id}`, { sortOrder: phase.sortOrder + delta }), 'Couldn\'t move phase', 'Could not move this phase')
}
const deletingPhase = ref<ProgramPhase | null>(null)
const deleteOpen = ref(false)
function confirmDeletePhase() {
  deleteOpen.value = false
  if (deletingPhase.value) act(call('DELETE', `program-phases/${deletingPhase.value.id}`), 'Couldn\'t delete phase', 'Could not delete this phase')
}

const whenOpen = ref(false)
const replaceOpen = ref(false)
const pendingWhen = ref<StartWhen | null>(null)
async function start(when: StartWhen, replace = false) {
  try {
    await enroll(id, when, replace)
    await navigateTo('/workouts/programs')
  } catch (err: unknown) {
    if (!replace && errorCode(err) === 'enrollment_exists') {
      pendingWhen.value = when
      replaceOpen.value = true
      return
    }
    toast.add({ title: 'Couldn\'t start program', description: errorMessage(err, 'Could not start this program'), color: 'error' })
  }
}
function confirmReplace() {
  replaceOpen.value = false
  if (pendingWhen.value) start(pendingWhen.value, true)
}

function phaseMenu(phase: ProgramPhase): DropdownMenuItem[][] {
  return [[
    { label: 'Edit phase', icon: 'i-lucide-pencil', testId: `phase-edit-menu-${phase.id}`, onSelect: () => openPhase(phase) }
  ], [
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error',
      testId: `phase-delete-${phase.id}`,
      onSelect: () => {
        deletingPhase.value = phase
        deleteOpen.value = true
      }
    }
  ]]
}

const startWeek = (index: number) => 1 + program.value!.phases.slice(0, index).reduce((sum, phase) => sum + phase.weeks, 0)
const weeksLabel = (phase: ProgramPhase, index: number) => phase.weeks === 1
  ? `Week ${startWeek(index)}`
  : `Weeks ${startWeek(index)}–${startWeek(index) + phase.weeks - 1}`
</script>

<template>
  <UDashboardPanel id="workout-program">
    <template #header>
      <UDashboardNavbar>
        <template #title>
          <span class="truncate" data-test="program-title">{{ program?.name ?? 'Program' }}</span>
        </template>
        <template #leading>
          <UButton icon="i-lucide-arrow-left" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Back to programs" to="/workouts/programs" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="program" class="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-24 lg:pb-4">
        <UInput
          v-model="nameDraft"
          :maxlength="255"
          aria-label="Program name"
          data-test="program-name"
          @change="saveName"
        />
        <UTextarea
          v-model="descriptionDraft"
          :rows="2"
          :maxlength="2000"
          autoresize
          placeholder="Description"
          aria-label="Program description"
          data-test="program-description"
          @change="saveDescription"
        />

        <p class="text-sm text-muted" data-test="program-total">{{ program.totalWeeks }} {{ program.totalWeeks === 1 ? 'week' : 'weeks' }}</p>

        <div v-for="(phase, index) in program.phases" :key="phase.id" class="flex items-center gap-2 rounded-lg border border-default bg-default px-3 py-2" :data-test="`phase-card-${phase.id}`">
          <span class="size-2.5 shrink-0 rounded-full" :class="phaseColorClass(index)" />
          <button type="button" class="flex min-h-10 min-w-0 flex-1 flex-col justify-center text-left" :data-test="`phase-edit-${phase.id}`" @click="openPhase(phase)">
            <span class="flex items-center gap-2">
              <span class="line-clamp-2 min-w-0 wrap-anywhere font-medium text-highlighted">{{ phase.name }}</span>
              <UBadge v-if="phase.deload" label="Deload" color="warning" variant="subtle" size="sm" />
            </span>
            <span class="wrap-anywhere text-xs text-dimmed">
              {{ weeksLabel(phase, index) }} ·
              <template v-if="phase.routine">{{ phase.routine.name }}<span v-if="!phase.routine.dayCount" class="text-error"> (no days)</span></template>
              <template v-else>Rest week</template>
            </span>
          </button>
          <UButton icon="i-lucide-chevron-up" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Move up" :disabled="index === 0" :data-test="`phase-up-${phase.id}`" @click="movePhase(phase, -1)" />
          <UButton icon="i-lucide-chevron-down" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Move down" :disabled="index === program.phases.length - 1" :data-test="`phase-down-${phase.id}`" @click="movePhase(phase, 1)" />
          <UDropdownMenu :items="phaseMenu(phase)">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Phase actions" :data-test="`phase-menu-${phase.id}`" />
            <template #item-label="{ item }">
              <span :data-test="item.testId">{{ item.label }}</span>
            </template>
          </UDropdownMenu>
        </div>

        <UButton label="Add phase" icon="i-lucide-plus" variant="soft" color="neutral" block class="min-h-10" data-test="phase-add" @click="openPhase(null)" />

        <div class="fixed inset-x-0 bottom-0 z-10 border-t border-default bg-default/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:sticky lg:inset-x-auto lg:-bottom-6 lg:px-0 lg:pb-4">
          <UButton
            :label="running ? 'Running' : 'Start program'"
            icon="i-lucide-play"
            block
            class="min-h-10"
            :disabled="running || !program.phases.length"
            data-test="program-start"
            @click="whenOpen = true"
          />
        </div>
      </div>

      <WorkoutProgramPhaseSheet v-model:open="sheetOpen" :phase="editing" :routines="routineList ?? []" @save="savePhase" />
      <WorkoutProgramWhenSheet v-model:open="whenOpen" :title="`Start ${clipName(program?.name ?? 'program')}`" :week="1" :today="today" @choose="start($event)" />

      <WorkoutProgramReplacePrompt
        v-model:open="replaceOpen"
        :running="enrollment?.program.name ?? 'your program'"
        :next="program?.name ?? 'this program'"
        @confirm="confirmReplace"
      />

      <UModal v-model:open="deleteOpen" :title="`Delete ${clipName(deletingPhase?.name ?? 'phase')}?`" description="Logged workouts stay." :ui="{ title: 'wrap-anywhere', description: 'wrap-anywhere', footer: 'justify-end' }">
        <template #footer>
          <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="deleteOpen = false" />
          <UButton label="Delete" color="error" class="min-h-10" data-test="phase-delete-confirm" @click="confirmDeletePhase" />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
