<script setup lang="ts">
import { clockLabel, parseClock } from '~~/shared/utils/cardioUnits'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ step?: number; placeholder?: string; disabled?: boolean }>(), {
  step: undefined,
  placeholder: '',
  disabled: false
})
const model = defineModel<number | null>({ default: null })

const show = (value: number | null) => (value === null ? '' : clockLabel(value))
const text = ref(show(model.value))
const focused = ref(false)
watch(model, (value) => {
  if (!focused.value && parseClock(text.value) !== value) text.value = show(value)
})

function onInput(value: string | number) {
  text.value = String(value)
  model.value = parseClock(text.value)
}

function onBlur() {
  focused.value = false
  text.value = show(model.value)
}

function stepBy(direction: 1 | -1) {
  model.value = Math.max(0, (model.value ?? 0) + direction * (props.step ?? 1))
}
</script>

<template>
  <div class="flex w-full items-center gap-1" data-test="duration-input">
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
    <UInput
      :model-value="text"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full"
      v-bind="$attrs"
      @update:model-value="onInput"
      @focus="focused = true"
      @blur="onBlur"
    />
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
