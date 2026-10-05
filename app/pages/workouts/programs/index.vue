<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Program, ProgramImportResult, ProgramSummary, StartWhen } from '~~/shared/types/program'
import WorkoutEnrollmentCard from '~/components/workout/WorkoutEnrollmentCard.vue'
import WorkoutProgramReplacePrompt from '~/components/workout/WorkoutProgramReplacePrompt.vue'
import WorkoutProgramWhenSheet from '~/components/workout/WorkoutProgramWhenSheet.vue'
import { errorCode, errorMessage } from '~/utils/apiError'

const toast = useToast()
const { data } = await useWorkoutFetch<ProgramSummary[]>(WORKOUT_KEYS.programs, '/api/workouts/programs')
const programs = computed(() => data.value ?? [])
const { enrollment, today, enroll, pause, resume, end, dismiss } = useEnrollment()

function fail(title: string, err: unknown, fallback: string) {
  toast.add({ title, description: errorMessage(err, fallback), color: 'error' })
}

const newOpen = ref(false)
const newName = ref('')
async function create() {
  const name = newName.value.trim()
  if (!name) return
  try {
    const program = await apiFetch<Program>('/api/workouts/programs', { method: 'POST', body: { name } })
    newOpen.value = false
    newName.value = ''
    await invalidateWorkouts()
    await navigateTo(`/workouts/programs/${program.id}`)
  } catch (err: unknown) {
    fail('Couldn\'t create program', err, 'Could not create this program')
  }
}

const whenOpen = ref(false)
const whenMode = ref<{ kind: 'enroll', program: ProgramSummary } | { kind: 'resume' } | null>(null)
const replaceOpen = ref(false)
const pendingStart = ref<{ program: ProgramSummary, when: StartWhen } | null>(null)

function askEnroll(program: ProgramSummary) {
  whenMode.value = { kind: 'enroll', program }
  whenOpen.value = true
}
function askResume() {
  whenMode.value = { kind: 'resume' }
  whenOpen.value = true
}
async function chooseWhen(when: StartWhen) {
  const mode = whenMode.value
  if (!mode) return
  try {
    if (mode.kind === 'resume') await resume(when)
    else await enroll(mode.program.id, when)
  } catch (err: unknown) {
    if (mode.kind === 'enroll' && errorCode(err) === 'enrollment_exists') {
      pendingStart.value = { program: mode.program, when }
      replaceOpen.value = true
      return
    }
    if (mode.kind === 'resume') fail('Couldn\'t resume program', err, 'Could not resume this program')
    else fail('Couldn\'t start program', err, 'Could not start this program')
  }
}
async function confirmReplace() {
  replaceOpen.value = false
  const pending = pendingStart.value
  if (!pending) return
  try {
    await enroll(pending.program.id, pending.when, true)
  } catch (err: unknown) {
    fail('Couldn\'t start program', err, 'Could not start this program')
  }
}

const endOpen = ref(false)
async function confirmEnd() {
  endOpen.value = false
  try {
    await end()
  } catch (err: unknown) {
    fail('Couldn\'t end program', err, 'Could not end this program')
  }
}
async function run(action: () => Promise<unknown>, title: string, fallback: string) {
  try {
    await action()
  } catch (err: unknown) {
    fail(title, err, fallback)
  }
}

async function duplicate(program: ProgramSummary) {
  try {
    const copy = await apiFetch<Program>(`/api/workouts/programs/${program.id}/duplicate`, { method: 'POST' })
    await invalidateWorkouts()
    await navigateTo(`/workouts/programs/${copy.id}`)
  } catch (err: unknown) {
    fail('Couldn\'t duplicate program', err, 'Could not duplicate this program')
  }
}

const deleting = ref<ProgramSummary | null>(null)
const deleteOpen = ref(false)
async function confirmDelete() {
  const program = deleting.value
  deleteOpen.value = false
  if (!program) return
  try {
    await apiFetch(`/api/workouts/programs/${program.id}`, { method: 'DELETE' })
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail('Couldn\'t delete program', err, 'Could not delete this program')
  }
}

async function exportProgram(program: ProgramSummary) {
  let filename = 'program.json'
  try {
    const blob = await apiFetch<Blob>(`/api/workouts/programs/${program.id}/export`, {
      responseType: 'blob',
      onResponse: ({ response }) => {
        filename = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? filename
      }
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  } catch (err: unknown) {
    fail('Couldn\'t export program', err, 'Could not export this program')
  }
}

const deleteDescription = computed(() =>
  deleting.value && deleting.value.id === enrollment.value?.program.id
    ? 'Its phases are deleted and the program you are running ends. Routines and logged workouts stay.'
    : 'Its phases are deleted. Routines and logged workouts stay.'
)

function menu(program: ProgramSummary): DropdownMenuItem[][] {
  return [[
    { label: 'Start', icon: 'i-lucide-play', disabled: program.enrolled || program.phaseCount === 0, testId: `program-enroll-${program.id}`, onSelect: () => askEnroll(program) },
    { label: 'Duplicate', icon: 'i-lucide-copy', testId: `program-duplicate-${program.id}`, onSelect: () => duplicate(program) },
    { label: 'Export', icon: 'i-lucide-download', testId: `program-export-${program.id}`, onSelect: () => exportProgram(program) }
  ], [
    {
      label: 'Delete',
      icon: 'i-lucide-trash-2',
      color: 'error',
      testId: `program-delete-${program.id}`,
      onSelect: () => {
        deleting.value = program
        deleteOpen.value = true
      }
    }
  ]]
}

const fileInput = ref<HTMLInputElement | null>(null)
const headerMenu: DropdownMenuItem[][] = [[
  { label: 'Import program', icon: 'i-lucide-upload', testId: 'program-import', onSelect: () => fileInput.value?.click() }
]]
const importResult = ref<ProgramImportResult | null>(null)
const importOpen = ref(false)
async function onImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  let body: Record<string, unknown>
  try {
    body = JSON.parse(await file.text())
  } catch {
    toast.add({ title: 'Couldn\'t import program', description: 'That file is not a program export', color: 'error' })
    return
  }
  try {
    importResult.value = await apiFetch<ProgramImportResult>('/api/workouts/programs/import', { method: 'POST', body })
    importOpen.value = true
    await invalidateWorkouts()
  } catch (err: unknown) {
    fail('Couldn\'t import program', err, 'That file is not a program export')
  }
}

const whenTitle = computed(() => (whenMode.value?.kind === 'enroll' ? `Start ${clipName(whenMode.value.program.name)}` : 'Resume program'))
const whenWeek = computed(() => (whenMode.value?.kind === 'resume' ? (enrollment.value?.week ?? 1) : 1))
const phaseLabel = (n: number) => `${n} ${n === 1 ? 'phase' : 'phases'}`
const weekLabel = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`
</script>

<template>
  <UDashboardPanel id="workout-programs">
    <template #header>
      <UDashboardNavbar title="Programs">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton label="New" icon="i-lucide-plus" size="sm" aria-label="New program" data-test="program-new" @click="newOpen = true" />
          <UDropdownMenu :items="headerMenu">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" class="min-h-10 min-w-10 justify-center" aria-label="Program options" data-test="programs-menu" />
            <template #item-label="{ item }">
              <span :data-test="item.testId">{{ item.label }}</span>
            </template>
          </UDropdownMenu>
          <input ref="fileInput" type="file" accept=".json,application/json" class="hidden" data-test="program-import-file" @change="onImportFile">
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-2">
        <WorkoutEnrollmentCard
          v-if="enrollment"
          :enrollment="enrollment"
          class="mb-2"
          @pause="run(pause, 'Couldn\'t pause program', 'Could not pause this program')"
          @resume="askResume"
          @end="endOpen = true"
          @dismiss="run(dismiss, 'Couldn\'t dismiss program', 'Could not dismiss this')"
        />
        <p v-if="!programs.length" class="text-sm text-dimmed" data-test="programs-empty">
          No programs yet. A program runs your routines in phases over weeks, like 8 weeks of Upper / Lower then a deload.
        </p>
        <div v-for="program in programs" :key="program.id" class="flex items-center gap-2 rounded-lg border border-default bg-default px-3 py-2">
          <NuxtLink :to="`/workouts/programs/${program.id}`" class="flex min-h-10 min-w-0 flex-1 flex-col justify-center" :data-test="`program-row-${program.id}`">
            <span class="flex items-center gap-2">
              <span class="truncate font-medium text-highlighted">{{ program.name }}</span>
              <UBadge v-if="program.enrolled" label="Running" color="primary" variant="subtle" size="sm" />
            </span>
            <span class="truncate text-xs text-dimmed">{{ phaseLabel(program.phaseCount) }} · {{ weekLabel(program.totalWeeks) }}</span>
          </NuxtLink>
          <UDropdownMenu :items="menu(program)">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" class="size-10 justify-center" aria-label="Program actions" :data-test="`program-menu-${program.id}`" />
            <template #item-label="{ item }">
              <span :data-test="item.testId">{{ item.label }}</span>
            </template>
          </UDropdownMenu>
        </div>
      </div>

      <AppSheet v-model:open="newOpen" title="New program">
        <template #body>
          <form class="flex flex-col gap-3" @submit.prevent="create">
            <UInput v-model="newName" placeholder="e.g. Bigger Leaner Stronger" autofocus data-test="program-new-name" />
            <UButton type="submit" label="Create" block class="min-h-10" :disabled="!newName.trim()" data-test="program-new-save" />
          </form>
        </template>
      </AppSheet>

      <WorkoutProgramWhenSheet v-model:open="whenOpen" :title="whenTitle" :week="whenWeek" :today="today" @choose="chooseWhen" />

      <WorkoutProgramReplacePrompt
        v-model:open="replaceOpen"
        :running="enrollment?.program.name ?? 'your program'"
        :next="pendingStart?.program.name ?? 'this program'"
        @confirm="confirmReplace"
      />

      <UModal v-model:open="endOpen" :title="`End ${clipName(enrollment?.program.name ?? 'program')}?`" description="Your routines and logged workouts stay." :ui="{ title: 'wrap-anywhere', description: 'wrap-anywhere', footer: 'justify-end' }">
        <template #footer>
          <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="endOpen = false" />
          <UButton label="End program" color="error" class="min-h-10" data-test="enrollment-end-confirm" @click="confirmEnd" />
        </template>
      </UModal>

      <UModal v-model:open="deleteOpen" :title="`Delete ${clipName(deleting?.name ?? 'program')}?`" :description="deleteDescription" :ui="{ title: 'wrap-anywhere', description: 'wrap-anywhere', footer: 'justify-end' }">
        <template #footer>
          <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10" @click="deleteOpen = false" />
          <UButton label="Delete" color="error" class="min-h-10" data-test="program-delete-confirm" @click="confirmDelete" />
        </template>
      </UModal>

      <AppSheet v-model:open="importOpen" title="Program imported">
        <template #body>
          <div class="flex flex-col gap-3 text-sm" data-test="program-import-summary">
            <p>{{ importResult?.exercises.matched ?? 0 }} {{ (importResult?.exercises.matched ?? 0) === 1 ? 'exercise' : 'exercises' }} matched your library.</p>
            <div v-if="importResult?.exercises.created.length">
              <p>Created {{ importResult.exercises.created.length }} new {{ importResult.exercises.created.length === 1 ? 'exercise' : 'exercises' }}:</p>
              <ul class="list-disc ps-5 text-muted">
                <li v-for="name in importResult.exercises.created" :key="name">{{ name }}</li>
              </ul>
            </div>
            <UButton label="Open program" block class="min-h-10" :to="`/workouts/programs/${importResult?.programId}`" data-test="program-import-open" @click="importOpen = false" />
          </div>
        </template>
      </AppSheet>
    </template>
  </UDashboardPanel>
</template>
