<script setup lang="ts">
import type { ToolContext } from '~/components/workout/WorkoutToolsSheet.vue'
import { roundTenth } from '~~/shared/utils/oneRepMax'
import { loadPlan, roundToIncrement, roundToLoadable } from '~/utils/plateCalculator'

const props = defineProps<{ oneRm: number | null, pending: boolean, context: ToolContext }>()
const emit = defineEmits<{ use: [weight: number] }>()

const QUICK = [65, 75, 85, 90, 95]
const percent = ref<number | null>(85)

const barbell = computed(() => props.context.bar !== null && props.context.sizes !== null)
const raw = computed(() => (props.oneRm === null || percent.value === null ? null : roundTenth((props.oneRm * percent.value) / 100)))
const loadable = computed(() => {
  if (raw.value === null) return null
  return barbell.value
    ? roundToLoadable(raw.value, props.context.bar!, props.context.sizes!)
    : roundToIncrement(raw.value, props.context.increment)
})
const plates = computed(() => {
  if (!barbell.value || loadable.value === null) return null
  const perSide = loadPlan(loadable.value, props.context.bar!, props.context.sizes!).exact?.perSide ?? []
  return perSide.length ? `Each side: ${perSide.join(' · ')}` : 'Bar only'
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <p v-if="context.loadStyle === 'assisted'" class="text-center text-sm text-dimmed">Not available for assisted exercises.</p>
    <div
      v-else-if="pending && oneRm === null"
      class="flex flex-col items-center gap-2"
      data-test="set-calc-skeleton"
      aria-busy="true"
    >
      <USkeleton class="h-9 w-40 rounded-lg" />
      <USkeleton class="h-4 w-56 rounded" />
    </div>
    <p
      v-else-if="oneRm === null"
      class="text-center text-sm text-dimmed"
      data-test="set-calc-empty"
    >
      Needs a 1RM — log a set or enter one on the 1RM tab.
    </p>
    <template v-else>
      <p class="text-center text-xs text-dimmed">1RM ≈ {{ oneRm }} lb</p>
      <div class="flex flex-wrap justify-center gap-2">
        <UButton
          v-for="pct in QUICK"
          :key="pct"
          :label="`${pct}%`"
          :variant="percent === pct ? 'solid' : 'outline'"
          :color="percent === pct ? 'primary' : 'neutral'"
          class="min-h-10"
          :data-test="`set-calc-quick-${pct}`"
          @click="percent = pct"
        />
      </div>
      <div class="mx-auto w-32">
        <span class="text-sm font-medium text-dimmed">Percent</span>
        <AppNumberInput v-model="percent" :min="1" data-test="set-calc-percent" />
      </div>
      <p
        v-if="raw !== null"
        class="text-center text-sm text-dimmed"
        data-test="set-calc-raw"
      >
        {{ percent }}% = {{ raw }} lb
      </p>
      <p
        v-if="loadable !== null"
        class="text-center text-3xl font-bold tabular-nums"
        data-test="set-calc-loadable"
      >
        {{ loadable }} lb
      </p>
      <p v-if="plates" class="text-center text-sm font-medium" data-test="set-calc-plates">{{ plates }}</p>
      <UButton
        v-if="loadable !== null && barbell"
        label="Use this weight"
        variant="soft"
        class="min-h-10 self-center"
        data-test="set-calc-use"
        @click="emit('use', loadable)"
      />
    </template>
  </div>
</template>
