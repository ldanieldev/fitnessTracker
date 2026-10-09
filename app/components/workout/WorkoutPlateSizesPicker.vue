<script setup lang="ts">
import { MAX_PLATE_SIZES, normalizePlateSizes, plateSizesSchema } from '~~/shared/utils/plates'

const props = defineProps<{ choices: number[] }>()
const model = defineModel<number[]>({ required: true })

const draft = ref<number | null>(null)
const error = ref<string | null>(null)
// A size keeps its chip once seen here, so deselecting a typed size before save does not lose it.
const seen = ref<number[]>([...model.value])
const sizes = computed(() => normalizePlateSizes([...props.choices, ...seen.value, ...model.value]))

watch(model, (value) => {
  const added = value.filter((size) => !seen.value.includes(size))
  if (added.length) seen.value = [...seen.value, ...added]
})

watch(draft, () => {
  error.value = null
})

function selected(size: number) {
  return model.value.includes(size)
}

function toggle(size: number) {
  if (selected(size)) {
    if (model.value.length > 1) model.value = model.value.filter((value) => value !== size)
  } else if (model.value.length < MAX_PLATE_SIZES) {
    model.value = [...model.value, size]
  }
}

function rejection(size: number): string | null {
  if (selected(size)) return `${size} lb is already selected`
  if (size <= 0 || size > 100) return 'Enter a size from 0.01 to 100 lb'
  if (!plateSizesSchema.safeParse([...model.value, size]).success) return 'Use at most two decimals'
  return null
}

function add() {
  const size = draft.value
  if (size === null) return
  error.value = rejection(size)
  if (error.value) return
  model.value = [...model.value, size]
  draft.value = null
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap gap-2">
      <UButton
        v-for="size in sizes"
        :key="size"
        :label="String(size)"
        :variant="selected(size) ? 'solid' : 'outline'"
        :color="selected(size) ? 'primary' : 'neutral'"
        :aria-pressed="selected(size)"
        :disabled="selected(size) ? model.length === 1 : model.length >= MAX_PLATE_SIZES"
        class="min-h-10 min-w-12 justify-center"
        :data-test="`plate-chip-${size}`"
        @click="toggle(size)"
      />
    </div>
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <AppNumberInput
          v-model="draft"
          placeholder="Add a size (lb)"
          data-test="plate-add-input"
          :ui="{ base: 'min-h-10' }"
        />
      </div>
      <UButton
        label="Add"
        variant="soft"
        color="neutral"
        class="min-h-10"
        :disabled="model.length >= MAX_PLATE_SIZES"
        data-test="plate-add"
        @click="add"
      />
    </div>
    <p v-if="error" class="text-sm text-error" role="alert" data-test="plate-add-error">{{ error }}</p>
  </div>
</template>
