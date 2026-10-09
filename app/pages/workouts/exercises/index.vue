<script setup lang="ts">
import type { EquipmentRow, Exercise, ExerciseCategory, ExerciseListFilters, MuscleRow } from '~~/shared/types/workout'
import ExerciseFilterSheet from '~/components/workout/ExerciseFilterSheet.vue'
import ExerciseForm, { type ExerciseFormPayload } from '~/components/workout/ExerciseForm.vue'
import ExerciseListRow from '~/components/workout/ExerciseListRow.vue'

interface ReferenceData {
  categories: ExerciseCategory[]
  muscles: MuscleRow[]
  equipment: EquipmentRow[]
}

const filters = reactive<ExerciseListFilters>({})
const search = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(search, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    filters.q = value
  }, 200)
})

const { data: reference } = useExerciseFetch<ReferenceData>(EXERCISE_KEYS.reference, '/api/workouts/reference')
const PAGE_SIZE = 20
const pages = ref(1)
const filterKey = computed(() => exerciseListKey(filters))
watch(filterKey, () => {
  pages.value = 1
})
const pagedFilters = computed(() => ({ ...filters, limit: pages.value * PAGE_SIZE }))

const { data: exercises, status } = useExerciseFetch<Exercise[]>(
  () => exerciseListKey(pagedFilters.value),
  () => `/api/workouts/exercises?${exerciseListQuery(pagedFilters.value)}`
)

// Nuxt carries the previous key's rows into a new key while it loads, so track which filter produced what is shown.
const shownFilterKey = ref('')
const shownLimit = ref(PAGE_SIZE)
watch(
  [status, pagedFilters],
  ([value]) => {
    if (value !== 'success') return
    shownFilterKey.value = filterKey.value
    shownLimit.value = pages.value * PAGE_SIZE
  },
  { immediate: true }
)

const loading = computed(() => status.value === 'pending' || status.value === 'idle')
const stale = computed(() => loading.value && shownFilterKey.value !== filterKey.value)
const loadingMore = computed(() => loading.value && !stale.value)
const hasMore = computed(() => !stale.value && (exercises.value?.length ?? 0) === shownLimit.value)

function loadMore() {
  if (hasMore.value && !loading.value) pages.value++
}

const sentinel = ref<HTMLElement | null>(null)
const sentinelVisible = ref(false)
let observer: IntersectionObserver | undefined
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(
    (entries) => {
      sentinelVisible.value = entries.some((entry) => entry.isIntersecting)
    },
    { rootMargin: '200px' }
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
watch(sentinel, (element, previous) => {
  if (previous) observer?.unobserve(previous)
  if (element) observer?.observe(element)
  if (!element) sentinelVisible.value = false
})
onBeforeUnmount(() => observer?.disconnect())
// The observer fires only on visibility changes, so a sentinel still in view after a page lands pulls the next.
watch([sentinelVisible, loading], () => {
  if (sentinelVisible.value) loadMore()
})

const categories = computed(() => reference.value?.categories ?? [])
const muscles = computed(() => reference.value?.muscles ?? [])
const equipment = computed(() => reference.value?.equipment ?? [])

const activeChip = computed(() => {
  if (filters.favorites) return 'favorites'
  if (filters.categoryId !== undefined) return String(filters.categoryId)
  return 'all'
})

function selectAll() {
  filters.favorites = false
  filters.categoryId = undefined
}

function selectFavorites() {
  filters.favorites = true
  filters.categoryId = undefined
}

function toggleHidden() {
  filters.includeHidden = !filters.includeHidden
}

function selectCategory(category: ExerciseCategory) {
  filters.favorites = false
  filters.categoryId = category.id
}

const filterCount = computed(() => {
  let count = 0
  if (filters.muscles?.length) count++
  if (filters.equipment?.length) count++
  if (filters.difficulty) count++
  if (filters.includeHidden) count++
  return count
})

const filtersOpen = ref(false)

const facetScope = computed(() => ({ q: filters.q, categoryId: filters.categoryId, favorites: filters.favorites }))

const sheetFilters = computed(() => ({
  muscles: filters.muscles ?? [],
  equipment: filters.equipment ?? [],
  difficulty: filters.difficulty ?? null,
  includeHidden: filters.includeHidden ?? false
}))

interface SheetSelection {
  muscles: string[]
  equipment: string[]
  difficulty: ExerciseListFilters['difficulty']
  includeHidden: boolean
}

function applyFilters(next: SheetSelection) {
  filters.muscles = next.muscles
  filters.equipment = next.equipment
  filters.difficulty = next.difficulty
  filters.includeHidden = next.includeHidden
}

const formOpen = ref(false)
const editingId = ref<number | null>(null)
// Snapshotted once, not derived from the list, so a refetch dropping the row can't flip an open sheet to create mode.
const editingExercise = ref<Exercise | undefined>(undefined)
const { nameError, save } = useExerciseSave()
const fail = useFailToast()

watch(formOpen, (isOpen) => {
  if (!isOpen) editingExercise.value = undefined
})

function openCreate() {
  editingId.value = null
  editingExercise.value = undefined
  nameError.value = null
  formOpen.value = true
}

function findExercise(id: number) {
  return exercises.value?.find((e) => e.id === id)
}

async function onFavorite(id: number) {
  const exercise = findExercise(id)
  if (!exercise) return
  try {
    await apiFetch(`/api/workouts/exercises/${id}/favorite`, { method: exercise.favorite ? 'DELETE' : 'PUT' })
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t update favorite', error, 'Could not update this exercise')
  }
}

async function onHide(id: number) {
  const exercise = findExercise(id)
  if (!exercise) return
  const hiding = !exercise.hidden
  try {
    await apiFetch(`/api/workouts/exercises/${id}/hidden`, { method: hiding ? 'PUT' : 'DELETE' })
    await invalidateExercises()
  } catch (error: unknown) {
    fail(hiding ? 'Couldn\'t hide exercise' : 'Couldn\'t unhide exercise', error, 'Could not update this exercise')
  }
}

async function onFork(id: number) {
  try {
    await apiFetch(`/api/workouts/exercises/${id}/fork`, { method: 'POST' })
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t copy exercise', error, 'Could not copy this exercise')
  }
}

function onEdit(id: number) {
  editingId.value = id
  editingExercise.value = findExercise(id)
  nameError.value = null
  formOpen.value = true
}

async function onSubmit(payload: ExerciseFormPayload) {
  if (await save(payload, editingId.value)) formOpen.value = false
}
</script>

<template>
  <UDashboardPanel id="exercises">
    <template #header>
      <UDashboardNavbar title="Exercises">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            icon="i-lucide-plus"
            label="New"
            size="sm"
            aria-label="New exercise"
            data-test="exercise-create"
            @click="openCreate"
          />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <div class="flex items-center gap-2">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Search exercises"
            class="flex-1"
            data-test="exercise-search"
          />
          <div class="relative shrink-0">
            <UButton
              icon="i-lucide-sliders-horizontal"
              variant="soft"
              color="neutral"
              aria-label="Filters"
              data-test="filter-open"
              @click="filtersOpen = true"
            />
            <span
              v-if="filterCount > 0"
              class="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-inverted"
              data-test="filter-badge"
              >{{ filterCount }}</span
            >
          </div>
        </div>
        <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <UButton
            label="All"
            size="sm"
            :variant="activeChip === 'all' ? 'solid' : 'soft'"
            :color="activeChip === 'all' ? 'primary' : 'neutral'"
            data-test="chip-all"
            @click="selectAll"
          />
          <UButton
            label="Favourites"
            size="sm"
            :variant="activeChip === 'favorites' ? 'solid' : 'soft'"
            :color="activeChip === 'favorites' ? 'primary' : 'neutral'"
            data-test="chip-favorites"
            @click="selectFavorites"
          />
          <UButton
            label="Show hidden"
            size="sm"
            :variant="filters.includeHidden ? 'solid' : 'soft'"
            :color="filters.includeHidden ? 'primary' : 'neutral'"
            data-test="chip-hidden"
            @click="toggleHidden"
          />
          <UButton
            v-for="category in categories"
            :key="category.id"
            :label="category.name"
            size="sm"
            :variant="activeChip === String(category.id) ? 'solid' : 'soft'"
            :color="activeChip === String(category.id) ? 'primary' : 'neutral'"
            :data-test="`chip-category-${category.id}`"
            @click="selectCategory(category)"
          />
        </div>
        <div v-if="!exercises" class="flex flex-col gap-2" data-test="exercise-list-skeleton" aria-busy="true">
          <USkeleton v-for="i in 8" :key="i" class="h-14 rounded-xl" />
        </div>
        <div v-else class="relative">
          <UProgress v-if="stale" size="xs" class="absolute inset-x-0 -top-2" data-test="exercise-list-loading" />
          <div
            class="flex flex-col gap-2 transition-opacity"
            :class="stale ? 'pointer-events-none opacity-50' : ''"
            :aria-busy="stale"
            data-test="exercise-list"
          >
            <ExerciseListRow
              v-for="exercise in exercises"
              :key="exercise.id"
              :exercise="exercise"
              @favorite="onFavorite"
              @hide="onHide"
              @fork="onFork"
              @edit="onEdit"
            />
          </div>
          <p v-if="!loading && exercises.length === 0" class="text-sm text-dimmed">No exercises match</p>
          <div v-if="hasMore" ref="sentinel" class="flex justify-center py-3" data-test="exercise-list-end">
            <UIcon v-if="loadingMore" name="i-lucide-loader-circle" class="size-6 animate-spin text-dimmed" />
            <UButton
              v-else
              label="Show more"
              variant="soft"
              color="neutral"
              class="min-h-10"
              data-test="exercise-load-more"
              @click="loadMore"
            />
          </div>
        </div>
      </div>

      <ExerciseFilterSheet
        v-model:open="filtersOpen"
        :muscles
        :equipment
        :filters="sheetFilters"
        :scope="facetScope"
        @apply="applyFilters"
      />
      <ExerciseForm
        v-model:open="formOpen"
        :exercise="editingExercise"
        :categories
        :muscles
        :equipment
        :name-error="nameError"
        @submit="onSubmit"
      />
    </template>
  </UDashboardPanel>
</template>
