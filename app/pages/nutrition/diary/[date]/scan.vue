<script setup lang="ts">
const route = useRoute()
const date = computed(() => String(route.params.date))
const containerId = computed(() => {
  const n = Number(route.query.containerId)
  return Number.isFinite(n) && n > 0 ? n : undefined
})
</script>

<template>
  <UDashboardPanel id="diary-scan">
    <template #header>
      <AppNavbar title="Scan barcode" :back="`/nutrition/diary/${date}/add`" />
    </template>

    <template #body>
      <div class="max-w-3xl mx-auto w-full">
        <NutritionBarcodeScanner :date="date" :container-id="containerId" />
      </div>
    </template>
  </UDashboardPanel>
</template>
