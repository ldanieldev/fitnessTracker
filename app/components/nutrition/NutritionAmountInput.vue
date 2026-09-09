<script setup lang="ts">
import type { FoodForResolve, UnitSelection } from '~~/shared/types/nutrition'
import { NoWeightBasisError, resolveNutrition } from '~~/shared/utils/nutritionResolve'

const props = defineProps<{
  food: FoodForResolve
  modelValue: { quantity: number, unitLabel: string }
  nutrientKeys?: Record<number, string>
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: { quantity: number, unitLabel: string }]
}>()

const units = computed(() => availableUnits(props.food))

const quantity = computed({
  get: () => props.modelValue.quantity,
  set: (value: number) => emit('update:modelValue', { ...props.modelValue, quantity: value })
})

const unitLabel = computed({
  get: () => props.modelValue.unitLabel || defaultUnit(props.food),
  set: (value: string) => emit('update:modelValue', { ...props.modelValue, unitLabel: value })
})

watch(
  () => props.food,
  () => {
    if (!props.modelValue.unitLabel) {
      emit('update:modelValue', { ...props.modelValue, unitLabel: defaultUnit(props.food) })
    }
  },
  { immediate: true }
)

const PREVIEW_KEYS = ['energy', 'protein', 'carbohydrate', 'fat'] as const
type PreviewKey = (typeof PREVIEW_KEYS)[number]

const preview = computed<Partial<Record<PreviewKey, number>> | null>(() => {
  if (!props.nutrientKeys || !(quantity.value > 0)) return null
  const unit = units.value.find((u) => u.value === unitLabel.value)
  if (!unit) return null

  const selection: UnitSelection =
    unit.kind === 'mass'
      ? { type: 'mass', unit: unit.value as 'g' | 'oz' | 'lb' }
      : { type: 'serving', servingId: unit.servingId! }

  try {
    const resolved = resolveNutrition(props.food, selection, quantity.value)
    const byKey: Partial<Record<PreviewKey, number>> = {}
    for (const [id, amount] of Object.entries(resolved.nutrients)) {
      const key = props.nutrientKeys[Number(id)]
      if (key && (PREVIEW_KEYS as readonly string[]).includes(key)) byKey[key as PreviewKey] = amount
    }
    return byKey
  } catch (err) {
    if (err instanceof NoWeightBasisError) return null
    throw err
  }
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <UInputNumber v-model="quantity" :min="0" :disabled="disabled" class="w-28" />
      <USelect v-model="unitLabel" :items="units" :disabled="disabled" class="w-32" />
    </div>
    <p v-if="preview" class="text-xs text-dimmed">
      <span v-if="preview.energy !== undefined">{{ preview.energy.toFixed(0) }} kcal</span>
      <span v-if="preview.protein !== undefined"> · {{ preview.protein.toFixed(1) }} g protein</span>
      <span v-if="preview.carbohydrate !== undefined"> · {{ preview.carbohydrate.toFixed(1) }} g carb</span>
      <span v-if="preview.fat !== undefined"> · {{ preview.fat.toFixed(1) }} g fat</span>
    </p>
  </div>
</template>
