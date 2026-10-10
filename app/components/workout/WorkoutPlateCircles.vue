<script setup lang="ts">
import { loadPlan } from '~/utils/plateCalculator'

const props = defineProps<{ bar: number; sizes: number[] }>()
const model = defineModel<number | null>({ default: null })

const SIZE_PX: Record<number, number> = { 55: 80, 45: 72, 35: 64, 25: 56, 10: 48, 5: 40, 2.5: 34 }

const counts = reactive(new Map<number, number>())
const plan = computed(() => (model.value === null ? null : loadPlan(model.value, props.bar, props.sizes)))

function px(size: number) {
  return SIZE_PX[size] ?? 40
}

function count(size: number) {
  return counts.get(size) ?? 0
}

function loaded() {
  let perSide = 0
  for (const [size, n] of counts) perSide += size * n
  return Math.round((props.bar + 2 * perSide) * 100) / 100
}

function add(size: number) {
  counts.set(size, count(size) + 1)
  model.value = loaded()
}

function remove(size: number) {
  if (count(size) === 0) return
  counts.set(size, count(size) - 1)
  model.value = loaded()
}

// Re-seed only on an external change (typing, prefill, "Use this weight"); our own taps keep the user's plates.
watch(
  model,
  (weight) => {
    if (weight !== null && weight === loaded()) return
    counts.clear()
    if (weight === null) return
    for (const size of loadPlan(weight, props.bar, props.sizes).exact?.perSide ?? []) counts.set(size, count(size) + 1)
  },
  { immediate: true }
)
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <div class="flex flex-wrap items-center justify-center gap-3">
      <div v-for="size in sizes" :key="size" class="relative">
        <button
          type="button"
          class="flex min-h-10 min-w-10 items-center justify-center rounded-full transition-all active:scale-95"
          :aria-label="`Add a pair of ${size} lb plates`"
          :data-test="`plate-${size}`"
          @click="add(size)"
          @contextmenu.prevent="remove(size)"
        >
          <svg :width="px(size)" :height="px(size)" :viewBox="`0 0 ${px(size)} ${px(size)}`" class="drop-shadow-lg">
            <circle
              :cx="px(size) / 2"
              :cy="px(size) / 2"
              :r="px(size) / 2 - 2"
              fill="none"
              :stroke="count(size) > 0 ? 'var(--ui-primary)' : 'var(--ui-border-accented)'"
              :stroke-width="px(size) >= 56 ? 4 : 3"
            />
            <circle
              :cx="px(size) / 2"
              :cy="px(size) / 2"
              :r="px(size) / 2 - (px(size) >= 56 ? 8 : 6)"
              :fill="count(size) > 0 ? 'var(--ui-primary)' : 'var(--ui-bg-accented)'"
              :opacity="count(size) > 0 ? 0.15 : 0.3"
            />
            <text
              :x="px(size) / 2"
              :y="px(size) / 2"
              text-anchor="middle"
              dominant-baseline="central"
              :fill="count(size) > 0 ? 'var(--ui-primary)' : 'var(--ui-text-dimmed)'"
              :font-size="px(size) >= 56 ? 14 : 11"
              font-weight="bold"
            >
              {{ size }}
            </text>
          </svg>
        </button>
        <button
          v-if="count(size) > 0"
          type="button"
          class="
            absolute flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold
            text-inverted before:absolute before:bottom-1/2 before:left-1/2 before:-right-2.5 before:-top-0.5
            before:content-['']
          "
          :class="px(size) <= 40 ? '-right-2.5 -top-2.5' : '-right-1 -top-1'"
          :aria-label="`Remove a pair of ${size} lb plates`"
          :data-test="`plate-count-${size}`"
          @click="remove(size)"
        >
          {{ count(size) }}
        </button>
      </div>
    </div>
    <p v-if="plan?.belowBar" class="text-center text-xs text-warning" data-test="plates-below-bar">
      Less than the bar ({{ bar }} lb)
    </p>
    <p v-else-if="plan && !plan.exact" class="text-center text-xs text-warning" data-test="plates-cant-load">
      Can't load {{ model }} lb with these plates
    </p>
    <p class="text-center text-xs text-dimmed" data-test="plates-caption">
      Bar: {{ bar }} lb · Tap to add, tap the count to remove
    </p>
  </div>
</template>
