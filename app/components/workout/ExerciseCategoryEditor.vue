<script setup lang="ts">
import type { ExerciseCategory } from '~~/shared/types/workout'
import { CATEGORY_COLORS, CATEGORY_DOT_CLASS } from '~~/shared/utils/categoryColors'

const open = defineModel<boolean>('open', { default: false })
const fail = useFailToast()

const { data: categories } = useExerciseFetch<ExerciseCategory[]>(
  EXERCISE_KEYS.categoriesAll,
  '/api/workouts/categories?includeHidden=1'
)

const list = computed(() => categories.value ?? [])

const drafts = reactive<Record<number, string>>({})
watch(list, (rows) => {
  for (const c of rows) drafts[c.id] = c.name
}, { immediate: true })

async function renameCategory(category: ExerciseCategory) {
  const name = drafts[category.id]?.trim()
  if (!name || name === category.name) return
  try {
    await apiFetch(`/api/workouts/categories/${category.id}`, { method: 'PATCH', body: { name } })
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t rename category', error, 'Could not rename category')
  }
}

async function setColor(category: ExerciseCategory, color: string) {
  if (category.color === color) return
  try {
    await apiFetch(`/api/workouts/categories/${category.id}`, { method: 'PATCH', body: { color } })
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t update category colour', error, 'Could not update category colour')
  }
}

async function toggleHidden(category: ExerciseCategory) {
  try {
    await apiFetch(`/api/workouts/categories/${category.id}`, { method: 'PATCH', body: { hidden: !category.hidden } })
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t update category', error, 'Could not update category')
  }
}

async function moveCategory(category: ExerciseCategory, direction: -1 | 1) {
  const rows = list.value
  const index = rows.findIndex((c) => c.id === category.id)
  const neighbor = rows[index + direction]
  if (!neighbor) return
  try {
    // Sequential, not Promise.all: if the second PATCH fails, only the partner moves, not both onto one sortOrder.
    await apiFetch(`/api/workouts/categories/${neighbor.id}`, {
      method: 'PATCH',
      body: { sortOrder: category.sortOrder }
    })
    await apiFetch(`/api/workouts/categories/${category.id}`, {
      method: 'PATCH',
      body: { sortOrder: neighbor.sortOrder }
    })
  } catch (error: unknown) {
    fail('Couldn\'t reorder categories', error, 'Could not reorder categories')
  } finally {
    await invalidateExercises(EXERCISE_KEYS.categoriesAll, EXERCISE_KEYS.categories, EXERCISE_KEYS.reference)
  }
}

const deleteTarget = ref<ExerciseCategory | null>(null)
const moveTo = ref<number | undefined>(undefined)
const deleting = ref(false)

const moveToOptions = computed(() =>
  list.value.filter((c) => c.id !== deleteTarget.value?.id).map((c) => ({ label: c.name, value: c.id }))
)

function startDelete(category: ExerciseCategory) {
  deleteTarget.value = category
  const sharedFirst = list.value.find((c) => c.shared && c.id !== category.id)
  moveTo.value = sharedFirst?.id ?? moveToOptions.value[0]?.value ?? undefined
}

function cancelDelete() {
  deleteTarget.value = null
  moveTo.value = undefined
}

async function confirmDelete() {
  if (!deleteTarget.value || moveTo.value === undefined) return
  deleting.value = true
  try {
    await apiFetch(`/api/workouts/categories/${deleteTarget.value.id}?moveTo=${moveTo.value}`, { method: 'DELETE' })
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t delete category', error, 'Could not delete category')
  } finally {
    deleting.value = false
    deleteTarget.value = null
    moveTo.value = undefined
  }
}

const newName = ref('')
const newColor = ref(CATEGORY_COLORS[0])
const creating = ref(false)

async function createCategory() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    await apiFetch('/api/workouts/categories', { method: 'POST', body: { name, color: newColor.value } })
    newName.value = ''
    newColor.value = CATEGORY_COLORS[0]
    await invalidateExercises()
  } catch (error: unknown) {
    fail('Couldn\'t add category', error, 'Could not add category')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <AppSheet v-model:open="open" title="Categories">
    <template #body>
      <div class="flex flex-col gap-4">
        <div
          v-for="(category, index) in list"
          :key="category.id"
          class="flex flex-col gap-2"
          :class="category.hidden ? 'opacity-50' : ''"
        >
          <div class="flex items-center gap-2">
            <UInput
              v-model="drafts[category.id]"
              class="min-w-0 flex-1"
              :data-test="`category-name-${category.id}`"
              @blur="renameCategory(category)"
              @keyup.enter="($event.target as HTMLInputElement).blur()"
            />
            <UButton
              icon="i-lucide-arrow-up"
              variant="ghost"
              color="neutral"
              class="min-h-10 min-w-10 justify-center"
              aria-label="Move up"
              :disabled="index === 0"
              :data-test="`category-up-${category.id}`"
              @click="moveCategory(category, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              variant="ghost"
              color="neutral"
              class="min-h-10 min-w-10 justify-center"
              aria-label="Move down"
              :disabled="index === list.length - 1"
              :data-test="`category-down-${category.id}`"
              @click="moveCategory(category, 1)"
            />
            <UButton
              v-if="category.shared"
              :icon="category.hidden ? 'i-lucide-eye' : 'i-lucide-eye-off'"
              variant="ghost"
              color="neutral"
              class="min-h-10 min-w-10 justify-center"
              :aria-label="category.hidden ? 'Unhide category' : 'Hide category'"
              :data-test="`category-hide-${category.id}`"
              @click="toggleHidden(category)"
            />
            <UButton
              v-else
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              class="min-h-10 min-w-10 justify-center"
              aria-label="Delete category"
              :data-test="`category-delete-${category.id}`"
              @click="startDelete(category)"
            />
          </div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="color in CATEGORY_COLORS"
              :key="color"
              type="button"
              class="flex size-10 items-center justify-center"
              :aria-label="`Set colour ${color}`"
              :aria-pressed="category.color === color"
              :data-test="`category-color-${category.id}-${color}`"
              @click="setColor(category, color)"
            >
              <span
                class="size-5 rounded-full"
                :class="[
                  CATEGORY_DOT_CLASS[color],
                  category.color === color ? 'ring-2 ring-highlighted ring-offset-2 ring-offset-default' : ''
                ]"
              />
            </button>
          </div>
        </div>

        <div v-if="deleteTarget" class="flex flex-col gap-2 rounded-xl bg-elevated p-3">
          <p class="text-sm">Move exercises in "{{ deleteTarget.name }}" to:</p>
          <USelect v-model="moveTo" :items="moveToOptions" class="w-full" data-test="category-move-to" />
          <div class="flex gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" class="min-h-10 flex-1" @click="cancelDelete" />
            <UButton
              label="Delete"
              color="error"
              class="min-h-10 flex-1"
              :loading="deleting"
              data-test="category-delete-confirm"
              @click="confirmDelete"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2 border-t border-default pt-3">
          <p class="text-sm font-medium text-dimmed">New category</p>
          <div class="flex items-center gap-2">
            <UInput
              v-model="newName"
              placeholder="Category name"
              class="min-w-0 flex-1"
              data-test="category-new-name"
              @keyup.enter="createCategory"
            />
            <USelect
              v-model="newColor"
              :items="CATEGORY_COLORS.map((c) => ({ label: c, value: c }))"
              class="w-32"
              data-test="category-new-color"
            />
          </div>
          <UButton
            label="Add category"
            class="min-h-10"
            :loading="creating"
            data-test="category-new-save"
            @click="createCategory"
          />
        </div>
      </div>
    </template>
  </AppSheet>
</template>
