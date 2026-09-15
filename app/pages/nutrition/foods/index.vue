<script setup lang="ts">
interface ListedFood {
  id: number
  name: string
  brand: string | null
  defaultServing: { label: string, quantity: number } | null
  energy: number | null
}

const query = ref('')
const debouncedQuery = ref('')

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(query, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

const { data: foods } = await useNutritionFetch<ListedFood[]>(NUTRITION_KEYS.foods, '/api/nutrition/foods', { query: { q: debouncedQuery } })

function amountText(food: ListedFood) {
  return food.defaultServing ? `${food.defaultServing.quantity} ${food.defaultServing.label}` : null
}
</script>

<template>
  <UDashboardPanel id="nutrition-foods">
    <template #header>
      <UDashboardNavbar title="My Foods">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="New" size="sm" to="/nutrition/foods/new" data-test="new-food" />
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="flex flex-col gap-3 max-w-2xl mx-auto w-full">
        <UInput v-model="query" icon="i-lucide-search" placeholder="Search my foods" class="w-full" data-test="my-food-search" />
        <NutritionResultRow
          v-for="food in foods ?? []"
          :key="food.id"
          data-test="my-food-row"
          :title="food.name"
          :subtitle="food.brand"
          :amount-text="amountText(food)"
          :energy="food.energy"
          chevron
          @open="navigateTo(`/nutrition/foods/${food.id}`)"
        />
        <p v-if="(foods ?? []).length === 0 && query.trim()" class="text-sm text-dimmed">No matches for "{{ query }}"</p>
        <p v-else-if="(foods ?? []).length === 0" class="text-sm text-dimmed">No foods yet — foods you create or copy appear here</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
