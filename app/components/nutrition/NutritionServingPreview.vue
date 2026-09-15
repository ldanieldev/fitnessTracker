<script setup lang="ts">
import type { ServingDraft } from '~/utils/nutrition/servingDraft'
import { draftToInput } from '~/utils/nutrition/servingDraft'

const props = defineProps<{ draft: ServingDraft }>()

const ownNutrients = computed(() => draftToInput(props.draft).nutrients)
const hasOwnNutrients = computed(() => Object.keys(ownNutrients.value ?? {}).length > 0)
const hasBasis = computed(() => Number(props.draft.basisGrams) > 0)

const nutrients = computed(() => ({
  energy: ownNutrients.value?.energy,
  protein: ownNutrients.value?.protein,
  carbohydrate: ownNutrients.value?.carbohydrate,
  fat: ownNutrients.value?.fat
}))
</script>

<template>
  <div class="flex flex-wrap items-baseline gap-x-2 text-xs text-dimmed" data-test="serving-preview">
    <span>per {{ draft.quantity }} {{ draft.label }}</span>
    <NutritionMacroText v-if="hasOwnNutrients" with-energy :nutrients="nutrients" />
    <span v-else-if="hasBasis">derives from gram weight</span>
  </div>
</template>
