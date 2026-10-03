<script setup lang="ts">
import type { EquipmentRow, Exercise, ExerciseCategory, MuscleRow } from '~~/shared/types/workout'
import { CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'
import ExerciseForm, { type ExerciseFormPayload } from '~/components/workout/ExerciseForm.vue'

interface ReferenceData { categories: ExerciseCategory[], muscles: MuscleRow[], equipment: EquipmentRow[] }

const props = withDefaults(defineProps<{ title?: string }>(), { title: 'Add exercise' })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [exerciseId: number] }>()

const search = ref('')
const q = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    q.value = value
  }, 200)
})

const { data: exercises, execute } = useExerciseFetch<Exercise[]>(
  () => exerciseListKey({ q: q.value, limit: 20 }),
  () => `/api/workouts/exercises?${exerciseListQuery({ q: q.value, limit: 20 })}`,
  { immediate: false }
)

let keepSearch = false
watch(open, (isOpen) => {
  if (!isOpen) return
  if (!keepSearch) {
    clearTimeout(debounceTimer)
    search.value = ''
    q.value = ''
  }
  keepSearch = false
})

watch([open, q], ([isOpen]) => {
  if (isOpen) execute()
})

const { data: reference, execute: loadReference } = useExerciseFetch<ReferenceData>(
  EXERCISE_KEYS.reference,
  '/api/workouts/reference',
  { immediate: false }
)
const categories = computed(() => reference.value?.categories ?? [])
const muscles = computed(() => reference.value?.muscles ?? [])
const equipment = computed(() => reference.value?.equipment ?? [])

const formOpen = ref(false)
const editingExercise = ref<Exercise | undefined>(undefined)
const initialName = ref('')
const { nameError, save } = useExerciseSave()
let formDone = false

async function openForm(exercise: Exercise | undefined) {
  editingExercise.value = exercise
  initialName.value = exercise ? '' : search.value.trim()
  nameError.value = null
  formDone = false
  open.value = false
  await nextTick()
  if (categories.value.length === 0) await loadReference()
  formOpen.value = true
}

watch(formOpen, async (isOpen) => {
  if (isOpen || formDone || !editingExercise.value) return
  formDone = true
  keepSearch = true
  await nextTick()
  open.value = true
})

async function onSubmit(payload: ExerciseFormPayload) {
  const saved = await save(payload, editingExercise.value?.id ?? null)
  if (!saved) return
  formDone = true
  const editing = editingExercise.value !== undefined
  formOpen.value = false
  if (editing) {
    keepSearch = true
    await nextTick()
    open.value = true
  } else {
    emit('pick', saved.id)
  }
}

const list = computed(() => exercises.value ?? [])

function dotClass(exercise: Exercise) {
  return CATEGORY_DOT_CLASS[exercise.category.color] ?? CATEGORY_DOT_CLASS.fallback
}

function pick(exercise: Exercise) {
  emit('pick', exercise.id)
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" :title="props.title">
    <template #body>
      <div class="flex flex-col gap-3">
        <UInput
          v-model="search"
          autofocus
          icon="i-lucide-search"
          placeholder="Search exercises"
          class="w-full"
          data-test="exercise-search"
        />
        <UButton
          label="New exercise"
          icon="i-lucide-plus"
          variant="soft"
          color="neutral"
          class="min-h-10 self-start"
          data-test="exercise-new"
          @click="openForm(undefined)"
        />
        <div class="flex flex-col gap-1" data-test="exercise-list">
          <div v-for="exercise in list" :key="exercise.id" class="flex items-center gap-1">
            <button
              type="button"
              class="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-elevated"
              data-test="exercise-row"
              @click="pick(exercise)"
            >
              <span class="size-2.5 shrink-0 rounded-full" :class="dotClass(exercise)" />
              <span class="truncate font-medium text-highlighted">{{ exercise.name }}</span>
            </button>
            <UButton
              v-if="exercise.shared === false"
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              class="min-h-10 min-w-10 justify-center"
              aria-label="Edit"
              :data-test="`exercise-row-edit-${exercise.id}`"
              @click="openForm(exercise)"
            />
          </div>
        </div>
      </div>
    </template>
  </AppSheet>
  <ExerciseForm
    v-model:open="formOpen"
    :exercise="editingExercise"
    :initial-name="initialName"
    :categories
    :muscles
    :equipment
    :name-error="nameError"
    @submit="onSubmit"
  />
</template>
