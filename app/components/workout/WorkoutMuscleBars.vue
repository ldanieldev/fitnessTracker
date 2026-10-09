<script setup lang="ts">
import type { MuscleVolume } from '~~/shared/types/workout'

const props = defineProps<{ muscles: MuscleVolume[] }>()

const max = computed(() => Math.max(1, ...props.muscles.map((muscle) => muscle.volume)))

function widthFor(volume: number): string {
  return `${Math.max(2, (volume / max.value) * 100)}%`
}

function formatVolume(volume: number): string {
  return volume.toLocaleString(undefined, { maximumFractionDigits: 1 })
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="muscles.length === 0" class="text-sm text-dimmed" data-test="muscle-bars-empty">
      Nothing logged in this range
    </p>
    <template v-else>
      <p class="text-xs text-dimmed" data-test="muscle-bars-caption">
        Volume credited to each muscle as a prime mover — a lift with two primary muscles counts for both, so bars
        aren't a share of the total.
      </p>
      <div v-for="muscle in muscles" :key="muscle.key" class="flex flex-col gap-1" data-test="muscle-bar-row">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-highlighted">{{ muscle.name }}</span>
          <span class="text-dimmed">{{ formatVolume(muscle.volume) }} lb · {{ muscle.sets }} sets</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-elevated" data-test="muscle-bar-track">
          <div
            class="h-full rounded-full bg-primary"
            data-test="muscle-bar-fill"
            :style="{ width: widthFor(muscle.volume) }"
          />
        </div>
      </div>
    </template>
  </div>
</template>
