<script setup lang="ts">
// Neither filename shares the "workout" prefix Nuxt's auto-import dedup expects, so both need explicit imports.
import ExerciseBodyMap from './ExerciseBodyMap.vue'
import ExerciseCategoryEditor from './ExerciseCategoryEditor.vue'

interface FilterOption { key: string, name: string }
interface SheetFilters {
  muscles: string[]
  equipment: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null
  includeHidden: boolean
}

const props = defineProps<{ muscles: FilterOption[], equipment: FilterOption[], filters: SheetFilters }>()
const emit = defineEmits<{ apply: [filters: SheetFilters] }>()
const open = defineModel<boolean>('open', { default: false })

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const

const local = reactive<SheetFilters>({ muscles: [], equipment: [], difficulty: null, includeHidden: false })

function syncFromProps() {
  local.muscles = [...props.filters.muscles]
  local.equipment = [...props.filters.equipment]
  local.difficulty = props.filters.difficulty
  local.includeHidden = props.filters.includeHidden
}

// Re-sync on open so a filter half-set before Cancel never leaks into the next visit.
watch(open, (isOpen) => {
  if (isOpen) syncFromProps()
}, { immediate: true })

const availableMuscles = computed(() => props.muscles.map((m) => m.key))

function toggleMuscle(key: string) {
  local.muscles = local.muscles.includes(key) ? local.muscles.filter((k) => k !== key) : [...local.muscles, key]
}

function toggleEquipment(key: string) {
  local.equipment = local.equipment.includes(key) ? local.equipment.filter((k) => k !== key) : [...local.equipment, key]
}

function toggleDifficulty(level: SheetFilters['difficulty']) {
  local.difficulty = local.difficulty === level ? null : level
}

function clear() {
  local.muscles = []
  local.equipment = []
  local.difficulty = null
  local.includeHidden = false
}

function apply() {
  emit('apply', {
    muscles: [...local.muscles],
    equipment: [...local.equipment],
    difficulty: local.difficulty,
    includeHidden: local.includeHidden
  })
  open.value = false
}

const categoryEditorOpen = ref(false)
</script>

<template>
  <AppSheet v-model:open="open" title="Filter">
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-settings"
            variant="ghost"
            color="neutral"
            class="min-h-10 min-w-10 justify-center"
            aria-label="Manage categories"
            data-test="category-editor-open"
            @click="categoryEditorOpen = true"
          />
        </div>

        <ExerciseBodyMap :selected="local.muscles" :available="availableMuscles" @toggle="toggleMuscle" />

        <div>
          <p class="mb-2 text-sm font-medium text-dimmed">Equipment</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in equipment"
              :key="item.key"
              :label="item.name"
              class="min-h-10"
              :color="local.equipment.includes(item.key) ? 'primary' : 'neutral'"
              :variant="local.equipment.includes(item.key) ? 'solid' : 'soft'"
              :aria-pressed="local.equipment.includes(item.key)"
              :data-test="`equipment-${item.key}`"
              @click="toggleEquipment(item.key)"
            />
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-dimmed">Difficulty</p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="level in DIFFICULTIES"
              :key="level"
              :label="level"
              class="min-h-10 capitalize"
              :color="local.difficulty === level ? 'primary' : 'neutral'"
              :variant="local.difficulty === level ? 'solid' : 'soft'"
              :aria-pressed="local.difficulty === level"
              :data-test="`difficulty-${level}`"
              @click="toggleDifficulty(level)"
            />
          </div>
        </div>

        <div class="flex min-h-10 items-center justify-between">
          <span class="text-sm font-medium">Show hidden</span>
          <USwitch v-model="local.includeHidden" data-test="filter-hidden" />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full gap-2">
        <UButton
          label="Clear"
          color="neutral"
          variant="outline"
          class="min-h-10 flex-1"
          data-test="filter-clear"
          @click="clear"
        />
        <UButton label="Apply" class="min-h-10 flex-1" data-test="filter-apply" @click="apply" />
      </div>
    </template>
  </AppSheet>

  <ExerciseCategoryEditor v-if="categoryEditorOpen" v-model:open="categoryEditorOpen" />
</template>
