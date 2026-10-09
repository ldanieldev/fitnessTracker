<script setup lang="ts">
import type { Exercise, ExerciseCategory, SessionFilter, SessionFilterMatch } from '~~/shared/types/workout'
import type { Program, ProgramSummary } from '~~/shared/types/program'
import { CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'

const props = defineProps<{ filter: SessionFilter }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ apply: [filter: SessionFilter] }>()

const { data: reference } = useExerciseFetch<{ categories: ExerciseCategory[] }>(
  EXERCISE_KEYS.reference,
  '/api/workouts/reference'
)

const ANY = -1
const { data: programList } = useWorkoutFetch<ProgramSummary[]>(WORKOUT_KEYS.programs, '/api/workouts/programs', {
  lazy: true
})
const programId = ref(ANY)
const phaseId = ref(ANY)
const programDetail = ref<Program | null>(null)
const phasesLoading = ref(false)
let restoring = false
const isKnownProgram = (id: number) => id === ANY || !programList.value || programList.value.some((p) => p.id === id)

watch(programList, () => {
  if (isKnownProgram(programId.value)) return
  programId.value = ANY
  phaseId.value = ANY
})

watch(programId, async (id) => {
  const restore = restoring
  restoring = false
  if (!restore) phaseId.value = ANY
  programDetail.value = null
  phasesLoading.value = id !== ANY
  if (id === ANY) return
  try {
    const detail = await apiFetch<Program>(`/api/workouts/programs/${id}`)
    if (programId.value === id) programDetail.value = detail
  } catch {
    programDetail.value = null
  } finally {
    if (programId.value === id) phasesLoading.value = false
  }
})

const programItems = computed(() => [
  { label: 'Any program', value: ANY },
  ...(programList.value ?? []).map((p) => ({ label: p.name, value: p.id }))
])
const phaseItems = computed(() =>
  phasesLoading.value
    ? [{ label: 'Loading phases…', value: phaseId.value }]
    : [
        { label: 'Any phase', value: ANY },
        ...(programDetail.value?.phases ?? []).map((p) => ({ label: p.name, value: p.id }))
      ]
)

const categories = ref<number[]>([])
const match = ref<SessionFilterMatch>('any')
const exercise = ref<Pick<Exercise, 'id' | 'name' | 'loadStyle'> | null>(null)
const minWeight = ref<number | null>(null)
const minReps = ref<number | null>(null)
const pickerOpen = ref(false)
const exerciseId = ref<number | null>(null)

async function loadExercise(id: number) {
  try {
    const found = await apiFetch<Exercise>(`/api/workouts/exercises/${id}`)
    if (exerciseId.value === id) exercise.value = found
  } catch {
    if (exerciseId.value === id) exercise.value = null
  }
}

function pickExercise(id: number) {
  if (id !== exerciseId.value) {
    minWeight.value = null
    minReps.value = null
  }
  exerciseId.value = id
  exercise.value = null
  void loadExercise(id)
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    categories.value = [...(props.filter.categories ?? [])]
    match.value = props.filter.match ?? 'any'
    minWeight.value = props.filter.minWeight ?? null
    minReps.value = props.filter.minReps ?? null
    exercise.value = null
    const requested = props.filter.programId ?? ANY
    const savedProgram = isKnownProgram(requested) ? requested : ANY
    restoring = savedProgram !== programId.value
    programId.value = savedProgram
    phaseId.value = savedProgram === ANY ? ANY : (props.filter.phaseId ?? ANY)
    exerciseId.value = props.filter.exerciseId ?? null
    if (props.filter.exerciseId) void loadExercise(props.filter.exerciseId)
  },
  { immediate: true }
)

function toggle(id: number) {
  categories.value = categories.value.includes(id)
    ? categories.value.filter((c) => c !== id)
    : [...categories.value, id]
}

const chips = computed<Array<Pick<ExerciseCategory, 'id' | 'name' | 'color'>>>(() => {
  if (!reference.value) return []
  const known = new Set(reference.value.categories.map((c) => c.id))
  const unknown = categories.value
    .filter((id) => !known.has(id))
    .map((id) => ({ id, name: 'Unknown category', color: 'fallback' }))
  return [...reference.value.categories, ...unknown]
})

function clearExercise() {
  exerciseId.value = null
  exercise.value = null
  minWeight.value = null
  minReps.value = null
}

const weightLabel = computed(() => {
  if (exerciseId.value && !exercise.value) return 'Weight (lb)'
  return exercise.value?.loadStyle === 'assisted' ? 'Max assist (lb)' : 'Min weight (lb)'
})

function apply() {
  const filter: SessionFilter = {}
  if (categories.value.length) filter.categories = [...categories.value].sort((a, b) => a - b)
  if (categories.value.length > 1 && match.value === 'all') filter.match = 'all'
  if (exerciseId.value) {
    filter.exerciseId = exerciseId.value
    if (minWeight.value !== null) filter.minWeight = minWeight.value
    if (minReps.value !== null) filter.minReps = minReps.value
  }
  if (programId.value !== ANY && isKnownProgram(programId.value)) {
    filter.programId = programId.value
    if (phaseId.value !== ANY) filter.phaseId = phaseId.value
  }
  emit('apply', filter)
  open.value = false
}

function clear() {
  emit('apply', {})
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" title="Filter workouts">
    <template #body>
      <div class="flex flex-col gap-4" data-test="history-filter">
        <section class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-highlighted">Categories</h3>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="category in chips"
              :key="category.id"
              :variant="categories.includes(category.id) ? 'soft' : 'outline'"
              :color="categories.includes(category.id) ? 'primary' : 'neutral'"
              class="min-h-10"
              :data-test="`filter-category-${category.id}`"
              @click="toggle(category.id)"
            >
              <span
                class="size-2 rounded-full"
                :class="CATEGORY_DOT_CLASS[category.color] ?? CATEGORY_DOT_CLASS.fallback"
              />
              {{ category.name }}
            </UButton>
          </div>
          <div v-if="categories.length > 1" class="flex gap-2">
            <UButton
              label="Any"
              :variant="match === 'any' ? 'solid' : 'outline'"
              color="neutral"
              class="min-h-10"
              data-test="filter-match-any"
              @click="match = 'any'"
            />
            <UButton
              label="All"
              :variant="match === 'all' ? 'solid' : 'outline'"
              color="neutral"
              class="min-h-10"
              data-test="filter-match-all"
              @click="match = 'all'"
            />
          </div>
        </section>

        <section class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-highlighted">Exercise</h3>
          <div class="flex items-center gap-1">
            <UButton
              :label="exercise?.name ?? (exerciseId ? 'Exercise' : 'Any exercise')"
              variant="outline"
              color="neutral"
              class="min-h-10 min-w-0 flex-1"
              data-test="filter-exercise"
              @click="pickerOpen = true"
            />
            <UButton
              v-if="exerciseId"
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              class="min-h-10 min-w-10 justify-center"
              aria-label="Clear exercise"
              data-test="filter-exercise-clear"
              @click="clearExercise"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <UFormField :label="weightLabel">
              <AppNumberInput
                v-model="minWeight"
                :min="0"
                :max="2000"
                :disabled="!exerciseId"
                data-test="filter-min-weight"
              />
            </UFormField>
            <UFormField label="Min reps">
              <AppNumberInput
                v-model="minReps"
                :min="1"
                :max="1000"
                :step="1"
                :disabled="!exerciseId"
                data-test="filter-min-reps"
              />
            </UFormField>
          </div>
        </section>

        <section v-if="programList?.length" class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-highlighted">Program</h3>
          <USelect v-model="programId" :items="programItems" class="w-full" data-test="filter-program" />
          <USelect
            v-if="programId !== ANY"
            v-model="phaseId"
            :items="phaseItems"
            :disabled="phasesLoading"
            class="w-full"
            data-test="filter-phase"
          />
        </section>

        <div class="flex gap-2">
          <UButton
            label="Clear"
            variant="outline"
            color="neutral"
            class="min-h-10 flex-1 justify-center"
            data-test="filter-clear"
            @click="clear"
          />
          <UButton label="Apply" class="min-h-10 flex-1 justify-center" data-test="filter-apply" @click="apply" />
        </div>
      </div>

      <WorkoutExercisePicker v-model:open="pickerOpen" title="Choose exercise" @pick="pickExercise" />
    </template>
  </AppSheet>
</template>
