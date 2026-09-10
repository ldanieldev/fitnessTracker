<script setup lang="ts">
import type { DiaryEntryInput } from '~/composables/useDiaryDay'

const route = useRoute()
const date = computed(() => String(route.params.date))
const preselectFoodId = computed(() => {
  const n = Number(route.query.foodId)
  return Number.isFinite(n) && n > 0 ? n : undefined
})
const preselectNeedsNutrition = computed(() => route.query.needsNutrition === '1')

const { logEntries } = useDiaryDay(date)
const { data: containers } = await useFetch<Array<{ id: number, name: string }>>('/api/nutrition/meal-containers')

async function onSubmit(inputs: DiaryEntryInput[]) {
  const result = await logEntries(inputs)
  if (result) await navigateTo(`/diary/${date.value}`)
}
</script>

<template>
  <UDashboardPanel id="diary-add">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #title>
          <span class="font-semibold">Add food — {{ date }}</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto w-full">
        <NutritionFoodSearch
          v-if="containers"
          :date="date"
          :containers="containers"
          :preselect-food-id="preselectFoodId"
          :preselect-needs-nutrition="preselectNeedsNutrition"
          @submit="onSubmit"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
