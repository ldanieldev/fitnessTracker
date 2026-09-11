<script setup lang="ts">
import type { TrayMeal } from '~/composables/useAddTray'
import { errorMessage } from '~/utils/apiError'

interface MealRow {
  id: number
  name: string
  itemCount: number
  total: Record<string, number>
}

interface MealItem {
  name: string | null
  quantity: number
  unitLabel: string
  broken: boolean
}

const props = defineProps<{
  meals: MealRow[]
  selected: TrayMeal[]
}>()

const emit = defineEmits<{
  toggle: [meal: { id: number, name: string }, on: boolean]
}>()

const toast = useToast()
const selectedById = computed(() => new Map(props.selected.map((m) => [m.savedMealId, m])))
const expanded = reactive(new Set<number>())
const items = reactive(new Map<number, MealItem[]>())

async function toggleExpand(meal: MealRow) {
  if (expanded.has(meal.id)) {
    expanded.delete(meal.id)
    return
  }
  expanded.add(meal.id)
  if (items.has(meal.id)) return
  try {
    const detail = await $fetch<{ items: MealItem[] }>(`/api/nutrition/saved-meals/${meal.id}`)
    items.set(meal.id, detail.items)
  } catch (error: unknown) {
    expanded.delete(meal.id)
    toast.add({ title: 'Load failed', description: errorMessage(error, 'Could not load this meal'), color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="meal in meals" :key="meal.id" class="flex flex-col gap-2 p-2 rounded-lg bg-elevated/50" data-test="meal-choice">
      <div class="flex items-center gap-2 min-w-0">
        <UCheckbox
          :model-value="selectedById.has(meal.id)"
          data-test="meal-choice-checkbox"
          @update:model-value="(value) => emit('toggle', { id: meal.id, name: meal.name }, Boolean(value))"
        />
        <div class="flex flex-col min-w-0 flex-1">
          <span class="font-medium truncate">{{ meal.name }}</span>
          <span class="text-dimmed text-xs">{{ meal.itemCount }} items · {{ (meal.total.energy ?? 0).toFixed(0) }} kcal</span>
        </div>
        <UButton
          :icon="expanded.has(meal.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          variant="ghost"
          color="neutral"
          size="sm"
          aria-label="Expand items"
          data-test="meal-choice-expand"
          @click="toggleExpand(meal)"
        />
      </div>
      <ul v-if="expanded.has(meal.id)" class="flex flex-col gap-1 list-none p-0 m-0 ps-6">
        <li v-for="(item, index) in items.get(meal.id) ?? []" :key="index" class="flex items-center gap-2 text-sm" data-test="meal-choice-item">
          <span>{{ item.name }} — {{ item.quantity }} {{ item.unitLabel }}</span>
          <UBadge v-if="item.broken" label="Unavailable" color="error" variant="subtle" />
        </li>
      </ul>
    </div>
    <p v-if="meals.length === 0" class="text-sm text-dimmed">
      No saved meals yet
      <ULink to="/nutrition/saved-meals/new">New saved meal</ULink>
    </p>
  </div>
</template>
