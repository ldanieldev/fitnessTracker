<script setup lang="ts">
const { metrics, fetch } = useBodyOverview()
await fetch

const metric = computed(() => metrics.value.find((m) => m.type.key === 'bodyweight') ?? metrics.value[0] ?? null)
const logOpen = ref(false)
</script>

<template>
  <div v-if="metric" data-test="dashboard-body">
    <BodyMetricCard :metric="metric" @log="logOpen = true">
      <template #spark>
        <BodySparkline :points="metric.sparkline" />
      </template>
    </BodyMetricCard>
    <BodyEntrySheet v-model:open="logOpen" :type="metric.type" :entry="null" />
  </div>
</template>
