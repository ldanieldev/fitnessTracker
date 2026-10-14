<script setup lang="ts">
import type {
  FitNotesExerciseOption,
  FitNotesImportResult,
  FitNotesPreview,
  FitNotesPreviewExercise
} from '~~/shared/types/fitnotes'
import { errorMessage } from '~/utils/apiError'
import { plural } from '~/utils/plural'
import WorkoutExercisePicker from '~/components/workout/WorkoutExercisePicker.vue'

type JobStatus = 'queued' | 'running' | 'done' | 'failed'

interface ImportJob {
  id: number
  status: JobStatus
  result: FitNotesImportResult | null
  error: string | null
}

const toast = useToast()

const csv = ref<string | null>(null)
const fileName = ref('')
const previewing = ref(false)
const preview = ref<FitNotesPreview | null>(null)
const targets = ref<Record<string, FitNotesExerciseOption | null>>({})
const skipExistingDays = ref(true)
const onlyNew = ref(false)
const status = ref<JobStatus | null>(null)
const result = ref<FitNotesImportResult | null>(null)
const jobError = ref<string | null>(null)
let pollTimer: ReturnType<typeof setTimeout> | null = null
let unmounted = false
// Null drops UInput's default autocomplete="off", invalid on a file input; the prop type has no null, hence untyped.
const fileAttrs: Record<string, unknown> = { autocomplete: null }

const running = computed(() => status.value === 'queued' || status.value === 'running')
const setCount = computed(() => {
  const sets = result.value?.sets ?? 0
  return `${sets.toLocaleString('en-US')} ${sets === 1 ? 'set' : 'sets'}`
})
const rows = computed(() => {
  const all = preview.value?.exercises ?? []
  return onlyNew.value ? all.filter((e) => !targets.value[e.name]) : all
})
const counts = computed(() => {
  const all = preview.value?.exercises ?? []
  const mapped = all.filter((e) => targets.value[e.name]).length
  return { mapped, created: all.length - mapped }
})

async function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  reset()
  if (!file) return
  fileName.value = file.name
  previewing.value = true
  try {
    const text = await file.text()
    const data = await apiFetch<FitNotesPreview>('/api/workouts/import/fitnotes/preview', {
      method: 'POST',
      body: { csv: text }
    })
    csv.value = text
    preview.value = data
    targets.value = Object.fromEntries(data.exercises.map((e) => [e.name, e.match]))
  } catch (error: unknown) {
    toast.add({
      title: 'Can’t read this file',
      description: errorMessage(error, 'Not a FitNotes export'),
      color: 'error'
    })
  } finally {
    previewing.value = false
  }
}

function reset() {
  clearPoll()
  csv.value = null
  fileName.value = ''
  preview.value = null
  targets.value = {}
  status.value = null
  result.value = null
  jobError.value = null
  onlyNew.value = false
}

const pickingFor = ref<FitNotesPreviewExercise | null>(null)
const pickerOpen = computed({
  get: () => pickingFor.value !== null,
  set: (value) => {
    if (!value) pickingFor.value = null
  }
})

async function onPick(exerciseId: number) {
  const row = pickingFor.value
  pickingFor.value = null
  if (!row) return
  try {
    const exercise = await apiFetch<{ id: number; name: string; shared: boolean }>(
      `/api/workouts/exercises/${exerciseId}`
    )
    choose(row.name, { id: exercise.id, name: exercise.name, custom: !exercise.shared })
  } catch (error: unknown) {
    toast.add({ title: 'Couldn’t use that exercise', description: errorMessage(error, 'Try again'), color: 'error' })
  }
}

function choose(name: string, option: FitNotesExerciseOption | null) {
  targets.value = { ...targets.value, [name]: option }
}

function categoryLabel(row: FitNotesPreviewExercise) {
  return row.category || 'No category'
}

function years(row: FitNotesPreviewExercise) {
  const first = row.firstDate.slice(0, 4)
  const last = row.lastDate.slice(0, 4)
  return first === last ? first : `${first}–${last}`
}

function clearPoll() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function poll(jobId: number) {
  pollTimer = setTimeout(async () => {
    try {
      const job = await apiFetch<ImportJob>(`/api/workouts/import/fitnotes/${jobId}`)
      if (unmounted) return
      status.value = job.status
      if (job.status === 'done' || job.status === 'failed') {
        result.value = job.result
        jobError.value = job.error
        if (job.status === 'done') await invalidateWorkouts()
      } else {
        poll(jobId)
      }
    } catch (error: unknown) {
      if (unmounted) return
      status.value = null
      toast.add({ title: 'Import failed', description: errorMessage(error, 'Import failed'), color: 'error' })
    }
  }, 2000)
}

async function submit() {
  if (!csv.value || running.value) return
  status.value = 'queued'
  const mapping = Object.fromEntries(Object.entries(targets.value).map(([name, option]) => [name, option?.id ?? null]))
  try {
    const { jobId } = await apiFetch<{ jobId: number }>('/api/workouts/import/fitnotes', {
      method: 'POST',
      body: { csv: csv.value, mapping, skipExistingDays: skipExistingDays.value }
    })
    poll(jobId)
  } catch (error: unknown) {
    status.value = null
    toast.add({ title: 'Import failed', description: errorMessage(error, 'Import failed'), color: 'error' })
  }
}

onBeforeUnmount(() => {
  unmounted = true
  clearPoll()
})
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-4">
    <UFormField v-if="!preview" label="FitNotes export (.csv)" name="fitnotesFile">
      <UInput
        type="file"
        accept=".csv,text/csv"
        :disabled="previewing"
        v-bind="fileAttrs"
        data-test="fitnotes-file"
        @change="onFileChange"
      />
    </UFormField>
    <p v-if="previewing" class="text-sm text-dimmed" data-test="fitnotes-reading">Reading the export…</p>

    <template v-if="preview && !result && status !== 'failed'">
      <div class="flex min-w-0 flex-col gap-1 text-sm wrap-anywhere" data-test="fitnotes-summary">
        <p class="text-highlighted">
          {{ preview.sets.toLocaleString('en-US') }} sets on {{ preview.days.toLocaleString('en-US') }} days,
          {{ preview.firstDate }} to {{ preview.lastDate }}
        </p>
        <p class="text-dimmed">
          {{ fileName }} · {{ plural(counts.mapped, 'exercise') }} matched · {{ counts.created }} to create
        </p>
        <p v-if="preview.importedDays" class="text-dimmed" data-test="fitnotes-imported-days">
          {{ plural(preview.importedDays, 'day') }} already imported will be skipped.
        </p>
      </div>

      <USwitch
        v-if="preview.existingDays"
        v-model="skipExistingDays"
        :label="`Skip ${plural(preview.existingDays, 'day')} that already have a workout in the app`"
        aria-label="Skip days that already have a workout"
        data-test="fitnotes-skip-existing"
      />
      <USwitch
        v-model="onlyNew"
        label="Only show exercises that will be created"
        aria-label="Only show exercises that will be created"
        data-test="fitnotes-only-new"
      />

      <ul class="flex w-full min-w-0 flex-col divide-y divide-default overflow-hidden rounded-lg border border-default">
        <li
          v-for="row in rows"
          :key="row.name"
          class="flex flex-col gap-1.5 px-3 py-2.5"
          :data-test="`fitnotes-row-${row.name}`"
        >
          <div class="flex items-start gap-2">
            <div class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-sm font-medium text-highlighted">{{ row.name }}</span>
              <span class="text-xs text-dimmed">
                {{ categoryLabel(row) }} · {{ row.sets }} sets · {{ years(row) }}{{ row.assisted ? ' · assisted' : '' }}
              </span>
            </div>
            <UButton
              label="Change"
              size="xs"
              variant="soft"
              color="neutral"
              :aria-label="`Choose the exercise for ${row.name}`"
              :data-test="`fitnotes-change-${row.name}`"
              @click="pickingFor = row"
            />
          </div>
          <div class="flex flex-wrap items-center gap-1.5 text-sm">
            <UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0 text-dimmed" />
            <span v-if="targets[row.name]" class="min-w-0 truncate" :data-test="`fitnotes-target-${row.name}`">
              {{ targets[row.name]!.name }}
            </span>
            <span v-else class="text-muted" :data-test="`fitnotes-target-${row.name}`">New exercise</span>
            <UButton
              v-if="targets[row.name]"
              label="Create new instead"
              size="xs"
              variant="link"
              color="neutral"
              :data-test="`fitnotes-new-${row.name}`"
              @click="choose(row.name, null)"
            />
            <template v-else>
              <UButton
                v-for="option in row.suggestions"
                :key="option.id"
                :label="option.name"
                size="xs"
                variant="outline"
                color="neutral"
                :aria-label="`Use ${option.name}`"
                :ui="{ label: 'whitespace-normal text-left' }"
                :data-test="`fitnotes-suggest-${row.name}-${option.id}`"
                @click="choose(row.name, option)"
              />
            </template>
          </div>
        </li>
      </ul>

      <div class="flex flex-wrap gap-2">
        <UButton
          label="Import"
          :loading="running"
          :disabled="running"
          data-test="fitnotes-submit"
          @click="submit"
        />
        <UButton
          label="Choose another file"
          variant="ghost"
          color="neutral"
          :disabled="running"
          data-test="fitnotes-reset"
          @click="reset"
        />
      </div>
      <p v-if="running" class="text-sm text-dimmed" data-test="fitnotes-status">
        Importing… this can take a minute for years of history.
      </p>
    </template>

    <template v-if="result">
      <p class="text-sm" data-test="fitnotes-result">
        {{ plural(result.daysImported, 'day') }} and {{ setCount }} imported ·
        {{ plural(result.exercisesCreated, 'exercise') }} created
        <template v-if="result.daysSkippedImported || result.daysSkippedExisting">
          · {{ plural(result.daysSkippedImported + result.daysSkippedExisting, 'day') }} skipped
        </template>
      </p>
      <UButton
        label="Import another file"
        variant="soft"
        color="neutral"
        class="self-start"
        data-test="fitnotes-again"
        @click="reset"
      />
    </template>

    <template v-if="status === 'failed'">
      <UAlert color="error" variant="subtle" title="Import failed" :description="jobError ?? undefined" />
      <UButton label="Start over" variant="soft" color="neutral" class="self-start" @click="reset" />
    </template>

    <WorkoutExercisePicker
      v-model:open="pickerOpen"
      :title="pickingFor ? `Map ${pickingFor.name}` : 'Choose exercise'"
      @pick="onPick"
    />
  </div>
</template>
