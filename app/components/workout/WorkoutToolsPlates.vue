<script setup lang="ts">
import { loadPlan } from '~/utils/plateCalculator'
import WorkoutPlateBar from '~/components/workout/WorkoutPlateBar.vue'

const props = defineProps<{ bar: number | null, sizes: number[] | null, barEditable: boolean, canUse?: boolean }>()
const target = defineModel<number | null>('target', { default: null })
const emit = defineEmits<{ 'update:bar': [bar: number | null], use: [weight: number] }>()

const plan = computed(() =>
  props.bar !== null && props.sizes && target.value !== null ? loadPlan(target.value, props.bar, props.sizes) : null)
const heaviest = computed(() => Math.max(...(props.sizes ?? [1])))
const eachSide = computed(() => {
  const plates = plan.value?.exact?.perSide ?? []
  return plates.length ? `Each side: ${plates.join(' · ')}` : 'Bar only'
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <span class="text-sm font-medium text-dimmed">Target (lb)</span>
        <AppNumberInput v-model="target" :min="0" :max="2000" :step="5" data-test="tools-target" />
      </div>
      <div v-if="barEditable" class="w-24 shrink-0">
        <span class="text-sm font-medium text-dimmed">Bar</span>
        <AppNumberInput :model-value="bar" data-test="tools-bar" @update:model-value="(value) => emit('update:bar', value)" />
      </div>
    </div>

    <p v-if="barEditable && bar === null" class="text-center text-sm text-dimmed" data-test="plates-no-bar">
      Enter the bar weight.
    </p>
    <p v-else-if="bar === null || !sizes" class="text-center text-sm text-dimmed" data-test="plates-not-barbell">
      Plates apply to barbell exercises.
    </p>
    <template v-else>
      <p class="text-center text-xs text-dimmed">Bar {{ bar }} lb · Plates {{ sizes.join(' · ') }}</p>
      <p v-if="target === null" class="text-center text-sm text-dimmed">Enter a weight to see what to load.</p>
      <p v-else-if="plan?.belowBar" class="text-center text-sm" data-test="plates-below-bar">
        Less than the bar ({{ bar }} lb)
      </p>
      <template v-else-if="plan?.exact">
        <WorkoutPlateBar :plates="plan.exact.perSide" :heaviest="heaviest" />
        <p class="text-center text-sm font-medium" data-test="plates-each-side">{{ eachSide }}</p>
        <UButton
          v-if="canUse"
          label="Use this weight"
          variant="soft"
          class="min-h-10 self-center"
          data-test="plates-use"
          @click="emit('use', plan!.exact!.total)"
        />
      </template>
      <div v-else-if="plan" class="flex flex-col gap-2 text-center">
        <p class="text-sm" data-test="plates-cant-load">Can't load {{ target }} lb</p>
        <div class="flex justify-center gap-2">
          <UButton
            v-if="plan.below"
            :label="`${plan.below.total} lb`"
            variant="soft"
            color="neutral"
            class="min-h-10"
            data-test="plates-nearest-below"
            @click="target = plan.below.total"
          />
          <UButton
            v-if="plan.above"
            :label="`${plan.above.total} lb`"
            variant="soft"
            color="neutral"
            class="min-h-10"
            data-test="plates-nearest-above"
            @click="target = plan.above.total"
          />
        </div>
      </div>
    </template>
  </div>
</template>
