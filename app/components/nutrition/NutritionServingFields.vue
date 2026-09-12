<script setup lang="ts">
import type { NutrientField, ServingDraft } from '~/utils/nutrition/servingDraft'
import { draftError } from '~/utils/nutrition/servingDraft'

defineProps<{ fields: NutrientField[], weightTaken?: boolean }>()
const draft = defineModel<ServingDraft>({ required: true })

const weightLabels = [{ label: 'g', value: 'g' }, { label: 'oz', value: 'oz' }, { label: 'lb', value: 'lb' }]
const error = computed(() => draftError(draft.value))

function patch(values: Partial<ServingDraft>) {
  draft.value = { ...draft.value, ...values }
}

function setKind(kind: 'weight' | 'named') {
  patch({ kind, label: kind === 'weight' ? 'g' : '', basisGrams: kind === 'weight' ? '' : draft.value.basisGrams })
}

function setNutrient(key: string, value: string) {
  patch({ nutrients: { ...draft.value.nutrients, [key]: value } })
}
</script>

<template>
  <div class="flex flex-col gap-3" data-test="serving-row">
    <div class="grid grid-cols-2 gap-2">
      <USelect
        :model-value="draft.kind"
        :items="[{ label: 'Weight', value: 'weight', disabled: weightTaken && draft.kind !== 'weight' }, { label: 'Named', value: 'named' }]"
        class="w-full"
        data-test="serving-kind"
        @update:model-value="(value) => setKind(value as 'weight' | 'named')"
      />
      <USelect
        v-if="draft.kind === 'weight'"
        :model-value="draft.label"
        :items="weightLabels"
        class="w-full"
        data-test="serving-label"
        @update:model-value="(value) => patch({ label: String(value) })"
      />
      <UInput
        v-else
        :model-value="draft.label"
        placeholder="e.g. slice"
        class="w-full"
        data-test="serving-label"
        @update:model-value="(value) => patch({ label: String(value) })"
      />
    </div>
    <div class="grid grid-cols-2 gap-2">
      <UFormField label="Quantity">
        <NutritionNumberInput :model-value="draft.quantity" :min="0" class="w-full" data-test="serving-quantity" @update:model-value="(value) => patch({ quantity: value ?? 0 })" />
      </UFormField>
      <UFormField v-if="draft.kind === 'named'" label="Grams (optional)">
        <UInput
          :model-value="draft.basisGrams"
          type="number"
          inputmode="decimal"
          class="w-full"
          data-test="serving-basis-grams"
          @update:model-value="(value) => patch({ basisGrams: String(value ?? '') })"
        />
      </UFormField>
    </div>
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <UFormField v-for="field in fields" :key="field.key" :label="`${field.name} (${field.unit})`">
        <UInput
          :model-value="draft.nutrients[field.key] ?? ''"
          type="number"
          inputmode="decimal"
          class="w-full"
          :data-test="`serving-${field.key}`"
          @update:model-value="(value) => setNutrient(field.key, String(value ?? ''))"
        />
      </UFormField>
    </div>
    <p v-if="error" class="text-xs text-error" data-test="serving-error">{{ error }}</p>
  </div>
</template>
