<script setup lang="ts">
const route = useRoute()
const date = computed(() => String(route.params.date))
const containerId = computed(() => {
  const n = Number(route.query.containerId)
  return Number.isFinite(n) && n > 0 ? n : undefined
})

async function onCreated() {
  const suffix = containerId.value !== undefined ? `?containerId=${containerId.value}` : ''
  await navigateTo(`/diary/${date.value}/add${suffix}`)
}
</script>

<template>
  <UDashboardPanel id="diary-new-food">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #title>
          <span class="font-semibold">New food</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto w-full">
        <NutritionFoodForm :prefill="{ barcode: String(route.query.barcode ?? '') || undefined }" @created="onCreated" />
      </div>
    </template>
  </UDashboardPanel>
</template>
