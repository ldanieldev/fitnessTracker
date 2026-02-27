<script setup lang="ts">
import { STANDARD_PLATES, DEFAULT_BAR_WEIGHT } from '~/constants/workout'
import type { PlateCount } from '~/types/workout'
import { calculateTotalWeight, calculatePlatesForWeight } from '~/utils/plateCalculator'

const model = defineModel<number>({ default: DEFAULT_BAR_WEIGHT })

const plates = ref<PlateCount[]>([])

// Plate sizes mapped to pixel dimensions — heavier plates are larger
const plateSizeMap: Record<number, number> = {
  45: 72,
  35: 64,
  25: 56,
  10: 48,
  5: 40,
  2.5: 34
}

function plateSize(weight: number): number {
  return plateSizeMap[weight] ?? 40
}

watch(
  model,
  (newWeight) => {
    const expected = calculateTotalWeight(plates.value, DEFAULT_BAR_WEIGHT)
    if (newWeight !== expected) {
      plates.value = calculatePlatesForWeight(newWeight, DEFAULT_BAR_WEIGHT)
    }
  },
  { immediate: true }
)

function addPlate(weight: number) {
  const existing = plates.value.find((p) => p.weight === weight)
  if (existing) {
    existing.count++
  } else {
    plates.value.push({ weight, count: 1 })
  }
  model.value = calculateTotalWeight(plates.value, DEFAULT_BAR_WEIGHT)
}

function removePlate(weight: number) {
  const existing = plates.value.find((p) => p.weight === weight)
  if (existing && existing.count > 0) {
    existing.count--
    if (existing.count === 0) {
      plates.value = plates.value.filter((p) => p.weight !== weight)
    }
  }
  model.value = calculateTotalWeight(plates.value, DEFAULT_BAR_WEIGHT)
}

function getPlateCount(weight: number): number {
  return plates.value.find((p) => p.weight === weight)?.count ?? 0
}

function onWeightInput(value: number | null | undefined) {
  if (value != null && value >= DEFAULT_BAR_WEIGHT) {
    model.value = value
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div class="flex items-center gap-4">
      <UInputNumber
        :model-value="model"
        :min="DEFAULT_BAR_WEIGHT"
        :step="5"
        size="xl"
        class="w-40 text-center"
        @update:model-value="onWeightInput"
      />
      <span class="text-lg font-semibold text-dimmed">LBS</span>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3">
      <button
        v-for="plate in STANDARD_PLATES"
        :key="plate"
        class="relative flex items-center justify-center rounded-full transition-all active:scale-95"
        :style="{ width: `${plateSize(plate)}px`, height: `${plateSize(plate)}px` }"
        @click="addPlate(plate)"
        @contextmenu.prevent="removePlate(plate)"
      >
        <svg
          :width="plateSize(plate)"
          :height="plateSize(plate)"
          :viewBox="`0 0 ${plateSize(plate)} ${plateSize(plate)}`"
          class="drop-shadow-lg"
        >
          <!-- Outer ring -->
          <circle
            :cx="plateSize(plate) / 2"
            :cy="plateSize(plate) / 2"
            :r="plateSize(plate) / 2 - 2"
            fill="none"
            :stroke="getPlateCount(plate) > 0 ? 'var(--color-primary-500)' : 'var(--color-neutral-600)'"
            :stroke-width="plateSize(plate) >= 56 ? 4 : 3"
          />
          <!-- Inner filled disc -->
          <circle
            :cx="plateSize(plate) / 2"
            :cy="plateSize(plate) / 2"
            :r="plateSize(plate) / 2 - (plateSize(plate) >= 56 ? 8 : 6)"
            :fill="getPlateCount(plate) > 0 ? 'var(--color-primary-500)' : 'var(--color-neutral-700)'"
            :opacity="getPlateCount(plate) > 0 ? 0.15 : 0.3"
          />
          <!-- Inner ring detail -->
          <circle
            :cx="plateSize(plate) / 2"
            :cy="plateSize(plate) / 2"
            :r="plateSize(plate) / 2 - (plateSize(plate) >= 56 ? 8 : 6)"
            fill="none"
            :stroke="getPlateCount(plate) > 0 ? 'var(--color-primary-500)' : 'var(--color-neutral-600)'"
            :stroke-width="1.5"
            :opacity="0.5"
          />
          <!-- Center hole -->
          <circle
            :cx="plateSize(plate) / 2"
            :cy="plateSize(plate) / 2"
            :r="plateSize(plate) >= 56 ? 6 : 4"
            fill="none"
            :stroke="getPlateCount(plate) > 0 ? 'var(--color-primary-500)' : 'var(--color-neutral-600)'"
            :stroke-width="1.5"
            :opacity="0.6"
          />
          <!-- Weight label -->
          <text
            :x="plateSize(plate) / 2"
            :y="plateSize(plate) / 2"
            text-anchor="middle"
            dominant-baseline="central"
            :fill="getPlateCount(plate) > 0 ? 'var(--color-primary-400)' : 'var(--color-neutral-400)'"
            :font-size="plateSize(plate) >= 56 ? 14 : 11"
            font-weight="bold"
          >
            {{ plate }}
          </text>
        </svg>
        <UBadge
          v-if="getPlateCount(plate) > 0"
          :label="String(getPlateCount(plate))"
          size="xs"
          class="absolute -top-1 -right-1"
        />
      </button>
    </div>

    <p class="text-xs text-dimmed">Bar: {{ DEFAULT_BAR_WEIGHT }} lbs &middot; Tap to add, right-click to remove</p>
  </div>
</template>
