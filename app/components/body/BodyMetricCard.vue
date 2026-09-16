<script setup lang="ts">
import { format } from 'date-fns'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { MetricOverview } from '~~/shared/types/body'
import { deltaTone, effectiveDirection, formatDelta, formatValue } from '~~/shared/utils/bodyMetrics'

const props = defineProps<{ metric: MetricOverview, menuItems?: DropdownMenuItem[] }>()
const emit = defineEmits<{ log: [] }>()

const delta = computed(() =>
  props.metric.latest && props.metric.previous ? props.metric.latest.value - props.metric.previous.value : null
)
const tone = computed(() => deltaTone(delta.value, effectiveDirection(props.metric.type, props.metric.goal)))
const when = computed(() => (props.metric.latest ? format(new Date(`${props.metric.latest.measuredOn}T00:00:00`), 'MMM d') : null))
</script>

<template>
  <UCard :data-test="`metric-card-${metric.type.id}`">
    <div class="flex items-center gap-3">
      <NuxtLink :to="`/body/${metric.type.id}`" class="flex min-w-0 flex-1 items-center gap-3" :data-test="`metric-link-${metric.type.id}`">
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="truncate text-sm font-medium text-dimmed">{{ metric.type.name }}</span>
          <span class="flex items-baseline gap-1">
            <span class="text-2xl font-semibold text-highlighted tabular-nums" :data-test="`metric-latest-${metric.type.id}`">
              {{ formatValue(metric.latest?.value, metric.type.precision) }}
            </span>
            <span class="text-sm text-muted">{{ metric.type.unit }}</span>
          </span>
          <span class="flex items-center gap-2 text-xs text-dimmed">
            <UBadge v-if="delta !== null" :color="tone" variant="subtle" class="tabular-nums" :data-test="`metric-delta-${metric.type.id}`">
              {{ formatDelta(delta, metric.type.precision) }}
            </UBadge>
            <span v-if="when">{{ when }}</span>
            <span v-else>Tap + to record a value</span>
          </span>
        </span>
        <slot name="spark" />
      </NuxtLink>
      <UButton
        icon="i-lucide-plus"
        variant="subtle"
        color="primary"
        :aria-label="`Log ${metric.type.name}`"
        :data-test="`metric-log-${metric.type.id}`"
        @click="emit('log')"
      />
      <UDropdownMenu v-if="menuItems?.length" :items="menuItems">
        <UButton icon="i-lucide-ellipsis-vertical" variant="subtle" color="neutral" :aria-label="`${metric.type.name} options`" :data-test="`metric-menu-${metric.type.id}`" />
      </UDropdownMenu>
    </div>
  </UCard>
</template>
