<script setup lang="ts">
interface RecipeRow {
  id: number
  name: string
  servings: number
  servingName: string
  perServing: Record<string, number>
  broken: boolean
}

const { data: recipes } = await useFetch<RecipeRow[]>('/api/nutrition/recipes')
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = [...(recipes.value ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows
})

function macros(row: RecipeRow) {
  const p = row.perServing
  return `${(p.energy ?? 0).toFixed(0)} kcal · P ${(p.protein ?? 0).toFixed(0)} · C ${(p.carbohydrate ?? 0).toFixed(0)} · F ${(p.fat ?? 0).toFixed(0)}`
}
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
        <NuxtLink
          v-for="row in filtered"
          :key="row.id"
          :to="`/nutrition/recipes/${row.id}`"
          class="flex items-center gap-3 p-3 rounded-lg bg-elevated/50 min-h-12"
          data-test="recipe-row"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-medium truncate">{{ row.name }}</span>
            <span class="text-dimmed text-xs">per {{ row.servingName }}: {{ macros(row) }}</span>
          </div>
          <UBadge v-if="row.broken" color="error" variant="subtle" label="Broken" />
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
        </NuxtLink>
        <p v-if="filtered.length === 0" class="text-sm text-dimmed">No recipes yet</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
