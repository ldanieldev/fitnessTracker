<script setup lang="ts">
interface SavedMealRow {
  id: number
  name: string
  itemCount: number
  total: Record<string, number>
}

const { data: meals } = await useNutritionFetch<SavedMealRow[]>(NUTRITION_KEYS.savedMeals, '/api/nutrition/saved-meals')
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = [...(meals.value ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows
})
</script>

<template>
  <UDashboardPanel id="nutrition-saved-meals">
    <template #header>
      <UDashboardNavbar title="Saved meals">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New" size="sm" to="/nutrition/saved-meals/new" data-test="new-saved-meal" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="flex flex-col gap-3 max-w-2xl mx-auto w-full">
        <UInput v-model="query" icon="i-lucide-search" placeholder="Search saved meals" class="w-full" data-test="saved-meal-search" />
        <NutritionResultRow
          v-for="row in filtered"
          :key="row.id"
          data-test="saved-meal-row"
          :title="row.name"
          :amount-text="`${row.itemCount} items`"
          :nutrients="row.total"
          :energy="row.total.energy ?? null"
          chevron
          @open="navigateTo(`/nutrition/saved-meals/${row.id}`)"
        />
        <p v-if="filtered.length === 0 && (meals ?? []).length > 0" class="text-sm text-dimmed">No matches for "{{ query }}"</p>
        <p v-else-if="filtered.length === 0" class="text-sm text-dimmed">No saved meals yet</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
