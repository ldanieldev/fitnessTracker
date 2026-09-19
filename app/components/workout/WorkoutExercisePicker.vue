<script setup lang="ts">
import type { Exercise } from '~~/shared/types/workout'
import { CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'

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

watch([open, q], ([isOpen]) => {
  if (isOpen) execute()
})

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
  <AppSheet v-model:open="open" title="Add exercise">
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
        <div class="flex flex-col gap-1" data-test="exercise-list">
          <button
            v-for="exercise in list"
            :key="exercise.id"
            type="button"
            class="flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-elevated"
            data-test="exercise-row"
            @click="pick(exercise)"
          >
            <span class="size-2.5 shrink-0 rounded-full" :class="dotClass(exercise)" />
            <span class="truncate font-medium text-highlighted">{{ exercise.name }}</span>
          </button>
        </div>
      </div>
    </template>
  </AppSheet>
</template>
