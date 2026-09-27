<script setup lang="ts">
import type { ChartRange } from '~~/shared/types/series'

const model = defineModel<ChartRange>({ default: 'mtd' })

const items = [
  { label: 'MTD', value: 'mtd' },
  { label: '1m', value: '1m' },
  { label: '3m', value: '3m' },
  { label: '6m', value: '6m' },
  { label: '1y', value: '1y' },
  { label: 'All', value: 'all' }
]

const value = computed({
  get: () => model.value as string,
  set: (next: string | number) => {
    model.value = String(next) as ChartRange
  }
})
</script>

<template>
  <UTabs v-model="value" :items="items" :content="false" size="sm" class="w-full" data-test="range-tabs" />
</template>
