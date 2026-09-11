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

const { data: foods } = await useFetch<ListedFood[]>('/api/nutrition/foods', { query: { q: debouncedQuery } })

function subtitle(food: ListedFood) {
  const serving = food.defaultServing ? `${food.defaultServing.quantity} ${food.defaultServing.label}` : null
  const energy = `${food.energy?.toFixed(0) ?? '—'} kcal`
  return [serving, energy].filter(Boolean).join(' · ')
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
        <NuxtLink
          v-for="food in foods ?? []"
          :key="food.id"
          :to="`/nutrition/foods/${food.id}`"
          class="flex items-center gap-3 p-3 rounded-lg bg-elevated/50 min-h-12"
          data-test="my-food-row"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <span class="font-medium truncate">{{ food.name }}</span>
            <span v-if="food.brand" class="text-dimmed text-xs truncate">{{ food.brand }}</span>
            <span class="text-dimmed text-xs">{{ subtitle(food) }}</span>
          </div>
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
        </NuxtLink>
        <p v-if="(foods ?? []).length === 0" class="text-sm text-dimmed">No foods yet — foods you create or copy appear here</p>
      </div>
    </template>
  </UDashboardPanel>
</template>
