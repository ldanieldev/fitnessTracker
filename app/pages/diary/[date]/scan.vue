<script setup lang="ts">
const route = useRoute()
const date = computed(() => String(route.params.date))
</script>

<template>
  <UDashboardPanel id="diary-scan">
    <template #header>
      <UDashboardNavbar>
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #title>
          <span class="font-semibold">Scan barcode</span>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-2xl mx-auto w-full">
        <NutritionBarcodeScanner :date="date" />
      </div>
    </template>
  </UDashboardPanel>
</template>
