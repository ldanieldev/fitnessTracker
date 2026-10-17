<script setup lang="ts">
import { isDiaryDateRoute } from '~/utils/nutrition/diaryDateParam'

definePageMeta({ validate: isDiaryDateRoute })

const route = useRoute()
const date = computed(() => String(route.params.date))
const containerId = computed(() => {
  const n = Number(route.query.containerId)
  return Number.isFinite(n) && n > 0 ? n : undefined
})

async function onCreated() {
  const suffix = containerId.value !== undefined ? `?containerId=${containerId.value}` : ''
  await navigateTo(`/nutrition/diary/${date.value}/add${suffix}`, { replace: true })
}
</script>

<template>
  <UDashboardPanel id="diary-new-food">
    <template #header>
      <AppNavbar title="New food" :back="`/nutrition/diary/${date}/add`" />
    </template>

    <template #body>
      <div class="max-w-3xl mx-auto w-full">
        <NutritionFoodForm
          :prefill="{ barcode: String(route.query.barcode ?? '') || undefined }"
          @created="onCreated"
        />
      </div>
    </template>
  </UDashboardPanel>
</template>
