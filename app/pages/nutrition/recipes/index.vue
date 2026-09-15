<script setup lang="ts">
interface RecipeRow {
  id: number
  name: string
  servings: number
  servingName: string
  perServing: Record<string, number>
  broken: boolean
}

const { data: recipes } = await useNutritionFetch<RecipeRow[]>(NUTRITION_KEYS.recipes, '/api/nutrition/recipes')
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = [...(recipes.value ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows
})
</script>

<template>
  <UDashboardPanel id="nutrition-recipes">
    <template #header>
      <UDashboardNavbar title="Recipes">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New" size="sm" to="/nutrition/recipes/new" data-test="new-recipe" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="flex flex-col gap-3 max-w-2xl mx-auto w-full">
        <UInput v-model="query" icon="i-lucide-search" placeholder="Search recipes" class="w-full" data-test="recipe-search" />
        <NutritionResultRow
          v-for="row in filtered"
          :key="row.id"
          data-test="recipe-row"
          :title="row.name"
          :amount-text="`per ${row.servingName}`"
          :nutrients="row.perServing"
          :energy="row.perServing.energy ?? null"
          chevron
          @open="navigateTo(`/nutrition/recipes/${row.id}`)"
        >
          <template v-if="row.broken" #actions>
            <UBadge color="error" variant="subtle" label="Broken" />
          </template>
        </NutritionResultRow>
        <p v-if="filtered.length === 0 && (recipes ?? []).length > 0" class="text-sm text-dimmed">No matches for "{{ query }}"</p>
        <p v-else-if="filtered.length === 0" class="text-sm text-dimmed">No recipes yet</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
