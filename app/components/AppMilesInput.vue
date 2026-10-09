<script setup lang="ts">
import { metersToMiles, milesToMeters } from '~~/shared/utils/cardioUnits'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ step?: number; placeholder?: string; disabled?: boolean }>(), {
  step: undefined,
  placeholder: '',
  disabled: false
})
const metres = defineModel<number | null>({ default: null })

// The setter only runs on a user edit, so the 0.01-mi display rounding never rewrites a stored distance.
const miles = computed({
  get: () => (metres.value === null ? null : metersToMiles(metres.value)),
  set: (value: number | null) => {
    metres.value = value === null ? null : milesToMeters(value)
  }
})

function stepBy(direction: 1 | -1) {
  const stepped = (metres.value ?? 0) + direction * milesToMeters(props.step ?? 1)
  metres.value = Math.max(0, Math.round(stepped * 100) / 100)
}
</script>

<template>
  <div class="flex w-full items-center gap-1" data-test="miles-input">
    <UButton
      v-if="step !== undefined"
      icon="i-lucide-minus"
      variant="soft"
      color="neutral"
      class="size-10 shrink-0"
      aria-label="Decrease"
      :disabled="disabled"
      @click="stepBy(-1)"
    />
    <AppNumberInput v-model="miles" :min="0" :placeholder="placeholder" :disabled="disabled" v-bind="$attrs" />
    <UButton
      v-if="step !== undefined"
      icon="i-lucide-plus"
      variant="soft"
      color="neutral"
      class="size-10 shrink-0"
      aria-label="Increase"
      :disabled="disabled"
      @click="stepBy(1)"
    />
  </div>
</template>
