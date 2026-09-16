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
  toggle: [recipe: { id: number, name: string, servingName: string, perServing: Record<string, number> }, on: boolean]
  servings: [recipeId: number, servings: number]
}>()

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.recipes.filter((r) => r.name.toLowerCase().includes(q)) : props.recipes
})

const selectedById = computed(() => new Map(props.selected.map((r) => [r.recipeId, r])))
</script>

<template>
  <div class="flex flex-col gap-3">
    <UInput v-model="query" icon="i-lucide-search" placeholder="Search recipes" aria-label="Search recipes" class="w-full" data-test="recipe-search" />
    <div class="flex flex-col gap-2">
      <NutritionResultRow
        v-for="row in filtered"
        :key="row.id"
        data-test="recipe-choice"
        :title="row.name"
        :amount-text="`per ${row.servingName}`"
        :nutrients="row.perServing"
        :energy="row.perServing.energy ?? null"
        selectable
        :selected="selectedById.has(row.id)"
        :disabled="row.broken"
        @toggle="(on) => emit('toggle', { id: row.id, name: row.name, servingName: row.servingName, perServing: row.perServing }, on)"
      >
        <template v-if="row.broken" #actions>
          <ULink :to="`/nutrition/recipes/${row.id}`" class="text-xs" data-test="recipe-fix-link">
            Fix ingredients →
          </ULink>
        </template>
        <template v-if="selectedById.has(row.id)" #default>
          <AppNumberInput
            :model-value="selectedById.get(row.id)!.servings"
            :min="0"
            :step="0.5"
            class="w-28"
            aria-label="Servings"
            data-test="recipe-choice-servings"
            @update:model-value="(value) => emit('servings', row.id, value ?? 0)"
          />
        </template>
      </NutritionResultRow>
      <p v-if="filtered.length === 0" class="text-sm text-dimmed">
        No recipes yet
        <ULink to="/nutrition/recipes/new">New recipe</ULink>
      </p>
    </div>
  </div>
</template>
