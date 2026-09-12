<script setup lang="ts">
import { parseAmount } from '~/utils/nutrition/numberInput'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ min?: number, step?: number, placeholder?: string, disabled?: boolean }>(), {
  min: undefined,
  step: undefined,
  placeholder: '',
  disabled: false
})
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

function onBlur() {
  focused.value = false
  text.value = model.value === null ? '' : String(model.value)
}

function stepBy(direction: 1 | -1) {
  const step = props.step ?? 1
  const next = (model.value ?? 0) + direction * step
  model.value = props.min !== undefined ? Math.max(props.min, next) : next
}
</script>

<template>
  <div class="flex w-full items-center gap-1">
    <UButton v-if="step !== undefined" icon="i-lucide-minus" variant="soft" color="neutral" aria-label="Decrease" :disabled="disabled" @click="stepBy(-1)" />
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
    <UButton v-if="step !== undefined" icon="i-lucide-plus" variant="soft" color="neutral" aria-label="Increase" :disabled="disabled" @click="stepBy(1)" />
  </div>
</template>
