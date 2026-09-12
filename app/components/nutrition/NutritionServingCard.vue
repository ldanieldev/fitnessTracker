<script setup lang="ts">
import type { ServingBasis } from '~~/shared/types/nutrition'
import { errorMessage } from '~/utils/apiError'
import { type NutrientField, draftError, draftFromServing, draftToInput, emptyDraft } from '~/utils/nutrition/servingDraft'

const props = defineProps<{
  foodId: number
  serving: ServingBasis | null
  fields: NutrientField[]
  weightTaken: boolean
  idToKey: Map<number, string>
}>()

const emit = defineEmits<{ saved: [], deleted: [], cancel: [] }>()

const original = computed(() => (props.serving ? draftFromServing(props.serving, props.idToKey) : emptyDraft()))
const draft = ref(original.value)
const dirty = computed(() => props.serving === null || JSON.stringify(draft.value) !== JSON.stringify(original.value))
// A sibling card's save reloads `food`, handing every card a fresh `serving` prop — only clobber this card's draft when it has no unsaved edit.
watch(original, (value) => {
  if (!dirty.value) draft.value = value
})

const error = ref<string | null>(null)
const busy = ref(false)

async function save() {
  if (draftError(draft.value)) return
  busy.value = true
  error.value = null
  try {
    const body = draftToInput(draft.value)
    if (props.serving) {
      await $fetch(`/api/nutrition/foods/${props.foodId}/servings/${props.serving.id}`, { method: 'PUT', body })
    } else {
      await $fetch(`/api/nutrition/foods/${props.foodId}/servings`, { method: 'POST', body })
    }
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    emit('saved')
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Could not save this serving')
  } finally {
    busy.value = false
  }
}

async function remove() {
  if (!props.serving) {
    emit('cancel')
    return
  }
  busy.value = true
  error.value = null
  try {
    await $fetch(`/api/nutrition/foods/${props.foodId}/servings/${props.serving.id}`, { method: 'DELETE' })
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
      <div class="flex gap-2">
        <UButton :label="serving ? 'Delete' : 'Discard'" color="error" variant="soft" :disabled="busy" data-test="serving-card-delete" @click="remove" />
        <UButton label="Save" class="ml-auto" :loading="busy" :disabled="!dirty || draftError(draft) !== null" data-test="serving-card-save" @click="save" />
      </div>
    </template>
  </UCard>
</template>
