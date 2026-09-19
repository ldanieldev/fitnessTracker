<script setup lang="ts">
import { MAX_PLATE_SIZES, normalizePlateSizes, plateSizesSchema } from '~~/shared/utils/plates'

const props = defineProps<{ choices: number[] }>()
const model = defineModel<number[]>({ required: true })

const draft = ref<number | null>(null)
const sizes = computed(() => normalizePlateSizes([...props.choices, ...model.value]))

function selected(size: number) {
  return model.value.includes(size)
}

function toggle(size: number) {
  if (selected(size)) {
    if (model.value.length > 1) model.value = model.value.filter((value) => value !== size)
  } else {
    model.value = [...model.value, size]
  }
}

function add() {
  const size = draft.value
  if (size === null || selected(size)) return
  const next = [...model.value, size]
  if (!plateSizesSchema.safeParse(next).success) return
  model.value = next
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
        :disabled="selected(size) && model.length === 1"
        class="min-h-10 min-w-12 justify-center"
        :data-test="`plate-chip-${size}`"
        @click="toggle(size)"
      />
    </div>
    <div class="flex items-center gap-2">
      <div class="min-w-0 flex-1">
        <AppNumberInput v-model="draft" placeholder="Add a size (lb)" data-test="plate-add-input" :ui="{ base: 'min-h-10' }" />
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
  </div>
</template>
