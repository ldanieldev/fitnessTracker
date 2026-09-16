<script setup lang="ts">
import type { BodyRange, MetricOverview } from '~~/shared/types/body'
import { formatValue } from '~~/shared/utils/bodyMetrics'

const props = defineProps<{ metric: MetricOverview, range: BodyRange }>()

const { series, trend, fetch } = useBodySeries(() => props.metric.type.id, () => props.range)
await fetch
</script>

<template>
  <UCard :data-test="`progress-card-${metric.type.id}`">
    <div class="mb-2 flex items-baseline justify-between gap-3">
      <NuxtLink :to="`/body/${metric.type.id}`" class="truncate font-medium" :data-test="`progress-link-${metric.type.id}`">
        {{ metric.type.name }}
      </NuxtLink>
      <span class="tabular-nums">
        <span class="text-lg font-semibold text-highlighted">{{ formatValue(metric.latest?.value, metric.type.precision) }}</span>
        <span class="text-xs text-muted">{{ metric.type.unit }}</span>
      </span>
    </div>
    <BodyMetricChart
      v-if="series"
      :points="series.points"
      :trend="trend"
      :goal="series.goal?.targetValue ?? null"
      :from="series.from"
      :to="series.to"
      :precision="metric.type.precision"
      :unit="metric.type.unit"
      :granularity="series.granularity"
    />
  </UCard>
</template>
