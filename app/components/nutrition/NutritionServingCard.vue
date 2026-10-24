<script setup lang="ts">
import type { ServingBasis } from '~~/shared/types/nutrition'
import { errorMessage } from '~/utils/apiError'
import {
  type NutrientField,
  draftError,
  draftFromServing,
  draftToInput,
  emptyDraft,
  fillDraftFromPer100g,
  type ServingDraft
} from '~/utils/nutrition/servingDraft'

const props = defineProps<{
  foodId: number
  serving: ServingBasis | null
  fields: NutrientField[]
  weightTaken: boolean
  idToKey: Map<number, string>
  initial?: ServingDraft
}>()

const emit = defineEmits<{ deleted: []; cancel: [] }>()

const original = computed(() =>
  props.serving ? draftFromServing(props.serving, props.idToKey) : (props.initial ?? emptyDraft())
)
const draft = ref(original.value)
const dirty = computed(() => props.serving === null || JSON.stringify(draft.value) !== JSON.stringify(original.value))
// The food's reload after a save or delete hands every card a fresh `serving`; keep a draft with unsaved edits.
watch(original, (value) => {
  if (!dirty.value) draft.value = value
})

const error = ref<string | null>(null)
const busy = ref(false)

const invalid = computed(() => draftError(draft.value) !== null)

async function save(): Promise<boolean> {
  if (invalid.value) return false
  busy.value = true
  error.value = null
  try {
    const body = draftToInput(draft.value)
    if (props.serving) {
      await apiFetch(`/api/nutrition/foods/${props.foodId}/servings/${props.serving.id}`, { method: 'PUT', body })
    } else {
      await apiFetch(`/api/nutrition/foods/${props.foodId}/servings`, { method: 'POST', body })
    }
    return true
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Could not save this serving')
    return false
  } finally {
    busy.value = false
  }
}

function fill(per100g: Partial<Record<string, number>>): number {
  const result = fillDraftFromPer100g(draft.value, per100g, props.fields)
  draft.value = result.draft
  return result.filled
}

const isWeight = computed(() => draft.value.kind === 'weight')

defineExpose({ dirty, invalid, isWeight, save, fill })

async function remove() {
  if (!props.serving) {
    emit('cancel')
    return
  }
  busy.value = true
  error.value = null
  try {
    await apiFetch(`/api/nutrition/foods/${props.foodId}/servings/${props.serving.id}`, { method: 'DELETE' })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    emit('deleted')
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Could not delete this serving')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard data-test="serving-card">
    <NutritionServingFields v-model="draft" :fields="fields" :weight-taken="weightTaken" />
    <NutritionServingPreview :draft="draft" class="mt-2" />
    <p v-if="error" class="text-sm text-error mt-2" data-test="serving-card-error">{{ error }}</p>
    <template #footer>
      <UButton
        :label="serving ? 'Delete' : 'Discard'"
        color="error"
        variant="soft"
        :disabled="busy"
        data-test="serving-card-delete"
        @click="remove"
      />
    </template>
  </UCard>
</template>
