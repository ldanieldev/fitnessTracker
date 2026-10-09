<script setup lang="ts">
import { parseAmount } from '~/utils/numberInput'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{ min?: number; max?: number; step?: number; placeholder?: string; disabled?: boolean }>(),
  {
    min: undefined,
    max: undefined,
    step: undefined,
    placeholder: '',
    disabled: false
  }
)
const model = defineModel<number | null>({ default: null })

const text = ref(model.value === null ? '' : String(model.value))
const focused = ref(false)
watch(model, (value) => {
  if (!focused.value && parseAmount(text.value) !== value) text.value = value === null ? '' : String(value)
})

function onInput(value: string | number) {
  text.value = String(value)
  model.value = parseAmount(text.value)
}

function onFocus() {
  focused.value = true
}

function clamp(value: number) {
  let next = value
  if (props.min !== undefined) next = Math.max(props.min, next)
  if (props.max !== undefined) next = Math.min(props.max, next)
  return next
}

// Clamping waits for blur so typing 15 into a min-10 field can pass through 1.
function onBlur() {
  focused.value = false
  const value = model.value === null ? null : clamp(model.value)
  if (value !== model.value) model.value = value
  text.value = value === null ? '' : String(value)
}

function stepBy(direction: 1 | -1) {
  model.value = clamp((model.value ?? 0) + direction * (props.step ?? 1))
}
</script>

<template>
  <div class="flex w-full items-center gap-1" data-test="number-input">
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
      inputmode="decimal"
      autocomplete="off"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full"
      v-bind="$attrs"
      @update:model-value="onInput"
      @focus="onFocus"
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
