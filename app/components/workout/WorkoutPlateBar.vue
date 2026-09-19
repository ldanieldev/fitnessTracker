<script setup lang="ts">
const props = defineProps<{ plates: number[], heaviest: number }>()

const WIDTH = 320
const HEIGHT = 120
const MID = HEIGHT / 2
const COLLAR_LEFT = 110
const COLLAR_RIGHT = 210
const SLEEVE = 100
const GAP = 2

const thickness = computed(() => Math.max(1, Math.min(12, SLEEVE / Math.max(props.plates.length, 1) - GAP)))
const label = computed(() => `Each side: ${props.plates.join(' · ')}`)

function plateHeight(size: number) {
  return 30 + 80 * (size / props.heaviest)
}

const rects = computed(() => props.plates.flatMap((size, i) => {
  const offset = i * (thickness.value + GAP) + GAP
  const height = plateHeight(size)
  const y = MID - height / 2
  return [
    { key: `r${i}`, size, x: COLLAR_RIGHT + offset, y, height },
    { key: `l${i}`, size, x: COLLAR_LEFT - offset - thickness.value, y, height }
  ]
}))
</script>

<template>
  <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" class="mx-auto block w-full max-w-sm" role="img" :aria-label="label" data-test="plate-bar">
    <rect x="4" :y="MID - 3" :width="WIDTH - 8" height="6" rx="3" class="fill-(--ui-bg-accented)" />
    <rect :x="COLLAR_LEFT - 2" :y="MID - 9" width="4" height="18" class="fill-(--ui-text-dimmed)" />
    <rect :x="COLLAR_RIGHT - 2" :y="MID - 9" width="4" height="18" class="fill-(--ui-text-dimmed)" />
    <g v-for="rect in rects" :key="rect.key">
      <rect
        :x="rect.x"
        :y="rect.y"
        :width="thickness"
        :height="rect.height"
        rx="2"
        class="fill-(--ui-primary)"
        data-test="plate"
      />
      <text
        v-if="thickness >= 10"
        :x="rect.x + thickness / 2"
        :y="MID"
        :transform="`rotate(-90 ${rect.x + thickness / 2} ${MID})`"
        text-anchor="middle"
        dominant-baseline="central"
        font-size="9"
        font-weight="600"
        class="fill-(--ui-text-inverted)"
      >{{ rect.size }}</text>
    </g>
  </svg>
</template>
