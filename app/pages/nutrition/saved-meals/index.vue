<script setup lang="ts">
interface SavedMealRow {
  id: number
  name: string
  itemCount: number
  total: Record<string, number>
}

const { data: meals } = await useFetch<SavedMealRow[]>('/api/nutrition/saved-meals')
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
        <NuxtLink
          v-for="row in filtered"
          :key="row.id"
          :to="`/nutrition/saved-meals/${row.id}`"
          class="flex items-center gap-3 p-3 rounded-lg bg-elevated/50 min-h-12"
          data-test="saved-meal-row"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-medium truncate">{{ row.name }}</span>
            <span class="text-dimmed text-xs">{{ row.itemCount }} items · {{ (row.total.energy ?? 0).toFixed(0) }} kcal</span>
          </div>
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
        </NuxtLink>
        <p v-if="filtered.length === 0" class="text-sm text-dimmed">No saved meals yet</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
