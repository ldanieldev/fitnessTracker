<script setup lang="ts">
import type { TrayRecipe } from '~/composables/useAddTray'

interface RecipeRow {
  id: number
  name: string
  servings: number
  servingName: string
  perServing: Record<string, number>
  broken: boolean
}

const props = defineProps<{
  recipes: RecipeRow[]
  selected: TrayRecipe[]
}>()

const emit = defineEmits<{
  toggle: [recipe: { id: number, name: string, servingName: string }, on: boolean]
  servings: [recipeId: number, servings: number]
}>()

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.recipes.filter((r) => r.name.toLowerCase().includes(q)) : props.recipes
})

const selectedById = computed(() => new Map(props.selected.map((r) => [r.recipeId, r])))

function macros(row: RecipeRow) {
  const p = row.perServing
  return `per ${row.servingName}: ${(p.energy ?? 0).toFixed(0)} kcal · P ${(p.protein ?? 0).toFixed(0)} · C ${(p.carbohydrate ?? 0).toFixed(0)} · F ${(p.fat ?? 0).toFixed(0)}`
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <UInput v-model="query" icon="i-lucide-search" placeholder="Search recipes" class="w-full" data-test="recipe-search" />
    <div class="flex flex-col gap-2">
      <div
        v-for="row in filtered"
        :key="row.id"
        class="flex flex-col gap-2 p-2 rounded-lg bg-elevated/50"
        data-test="recipe-choice"
      >
        <div class="flex items-center gap-2 min-w-0">
          <UCheckbox
            :model-value="selectedById.has(row.id)"
            :disabled="row.broken"
            data-test="recipe-choice-checkbox"
            @update:model-value="(value) => emit('toggle', { id: row.id, name: row.name, servingName: row.servingName }, Boolean(value))"
          />
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-medium truncate">{{ row.name }}</span>
            <span class="text-dimmed text-xs truncate">{{ macros(row) }}</span>
          </div>
          <ULink v-if="row.broken" :to="`/nutrition/recipes/${row.id}`" class="text-xs" data-test="recipe-fix-link">
            Fix ingredients →
          </ULink>
        </div>
        <UInputNumber
          v-if="selectedById.has(row.id)"
          :model-value="selectedById.get(row.id)!.servings"
          :min="0"
          :step="0.5"
          class="w-28"
          data-test="recipe-choice-servings"
          @update:model-value="(value) => emit('servings', row.id, value)"
        />
      </div>
      <p v-if="filtered.length === 0" class="text-sm text-dimmed">
        No recipes yet
        <ULink to="/nutrition/recipes/new">New recipe</ULink>
      </p>
    </div>
  </div>
</template>
