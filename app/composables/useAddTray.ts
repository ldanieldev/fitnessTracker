import { computed, reactive } from 'vue'
import type { DiaryEntryInput } from '~~/app/composables/useDiaryDay'
import type { PickedFood } from '~~/app/types/nutrition'

export interface TrayRecipe {
  recipeId: number
  name: string
  servings: number
  servingName: string
}

export interface TrayMeal {
  savedMealId: number
  name: string
}

export function useAddTray() {
  const state = reactive({ foods: [] as PickedFood[], recipes: [] as TrayRecipe[], meals: [] as TrayMeal[] })

  const count = computed(() => state.foods.length + state.recipes.length + state.meals.length)
  const ready = computed(() =>
    count.value > 0
    && state.foods.every((f) => f.quantity > 0 && f.unitLabel !== '')
    && state.recipes.every((r) => r.servings > 0)
  )

  function toggleRecipe(recipe: { id: number, name: string, servingName: string }, on: boolean) {
    state.recipes = state.recipes.filter((r) => r.recipeId !== recipe.id)
    if (on) state.recipes.push({ recipeId: recipe.id, name: recipe.name, servings: 1, servingName: recipe.servingName })
  }

  function setRecipeServings(recipeId: number, servings: number) {
    const entry = state.recipes.find((r) => r.recipeId === recipeId)
    if (entry) entry.servings = servings
  }

  function toggleMeal(meal: { id: number, name: string }, on: boolean) {
    state.meals = state.meals.filter((m) => m.savedMealId !== meal.id)
    if (on) state.meals.push({ savedMealId: meal.id, name: meal.name })
  }

  function remove(kind: 'food' | 'recipe' | 'meal', id: number) {
    if (kind === 'food') state.foods = state.foods.filter((f) => f.foodId !== id)
    if (kind === 'recipe') state.recipes = state.recipes.filter((r) => r.recipeId !== id)
    if (kind === 'meal') state.meals = state.meals.filter((m) => m.savedMealId !== id)
  }

  function clear() {
    state.foods = []
    state.recipes = []
    state.meals = []
  }

  function toEntryInputs(containerId: number): DiaryEntryInput[] {
    return [
      ...state.foods.map((f) => ({ entryType: 'food' as const, containerId, foodId: f.foodId, quantity: f.quantity, unitLabel: f.unitLabel })),
      // The server overwrites a recipe entry's unit with the recipe's serving name; the schema still requires one.
      ...state.recipes.map((r) => ({ entryType: 'recipe' as const, containerId, recipeId: r.recipeId, quantity: r.servings, unitLabel: r.servingName })),
      // The server expands a saved meal into per-item entries and ignores this quantity and unit.
      ...state.meals.map((m) => ({ entryType: 'food' as const, containerId, savedMealId: m.savedMealId, quantity: 1, unitLabel: 'meal' }))
    ]
  }

  return { state, count, ready, toggleRecipe, setRecipeServings, toggleMeal, remove, clear, toEntryInputs }
}
