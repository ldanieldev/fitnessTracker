<script setup lang="ts">
import type { NutrientKey } from '~~/shared/types/nutrition'
import { errorMessage } from '~/utils/apiError'
import type { ServingDraft } from '~/utils/nutrition/servingDraft'
import { emptyDraft, nutrientFields, draftToInput, applyParsedNutrients, draftError } from '~/utils/nutrition/servingDraft'
import { useTrackedNutrients } from '~/composables/useTrackedNutrients'

interface ParsedLabel {
  servingGrams: number | null
  nutrients: Partial<Record<NutrientKey, number>>
  confidence: number
}

const props = defineProps<{
  prefill?: {
    name?: string
    brand?: string
    barcode?: string
    servings?: Array<Partial<ServingDraft>>
  }
}>()

const emit = defineEmits<{
  created: [id: number]
}>()

const toast = useToast()
const { tracked } = useTrackedNutrients()

const name = ref(props.prefill?.name ?? '')
const brand = ref(props.prefill?.brand ?? '')
const barcode = ref(props.prefill?.barcode ?? '')
const loading = ref(false)
const showOcr = ref(false)

const servings = ref<ServingDraft[]>(
  props.prefill?.servings?.length ? props.prefill.servings.map((draft) => ({ ...emptyDraft(), ...draft })) : [emptyDraft()]
)

const fields = computed(() => nutrientFields(tracked.value ?? []))

function applyParsedLabel(result: ParsedLabel) {
  const draft = applyParsedNutrients(
    { ...emptyDraft(), label: 'serving', basisGrams: result.servingGrams != null ? String(result.servingGrams) : '' },
    result.nutrients,
    fields.value
  )
  if (servings.value.length === 1 && JSON.stringify(servings.value[0]) === JSON.stringify(emptyDraft())) {
    servings.value.splice(0, 1, draft)
  } else {
    servings.value.push(draft)
  }
  showOcr.value = false
}

function addServing() {
  servings.value.push(emptyDraft())
}

function removeServing(index: number) {
  if (servings.value.length > 1) servings.value.splice(index, 1)
}

const weightTaken = computed(() => servings.value.some((d) => d.kind === 'weight'))

const canSubmit = computed(() =>
  name.value.trim().length > 0 &&
  servings.value.filter((s) => s.kind === 'weight').length <= 1 &&
  servings.value.every((d) => !draftError(d))
)

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const result = await $fetch<{ id: number }>('/api/nutrition/foods', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        brand: brand.value.trim() || undefined,
        barcode: barcode.value.trim() || undefined,
        servings: servings.value.map(draftToInput)
      }
    })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    emit('created', result.id)
  } catch (err: unknown) {
    toast.add({
      title: 'Failed to create food',
      description: errorMessage(err, 'Could not create food'),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <UFormField label="Name" required>
        <UInput v-model="name" class="w-full" data-test="food-name" />
      </UFormField>
      <UFormField label="Brand">
        <UInput v-model="brand" class="w-full" />
      </UFormField>
      <UFormField label="Barcode">
        <UInput v-model="barcode" class="w-full" data-test="food-barcode" />
      </UFormField>

      <UButton
        :label="showOcr ? 'Hide label scanner' : 'Scan label'"
        variant="soft"
        color="neutral"
        class="w-fit"
        data-test="ocr-open"
        @click="showOcr = !showOcr"
      />
      <NutritionLabelOcr v-if="showOcr" @parsed="applyParsedLabel" />

      <div class="flex flex-col gap-3">
        <div v-for="(draft, index) in servings" :key="index" class="flex flex-col gap-2 p-3 rounded-lg bg-elevated/50">
          <div class="flex gap-2 items-center justify-between">
            <div class="flex-1">
              <NutritionServingFields v-model="servings[index]!" :fields="fields" :weight-taken="weightTaken && draft.kind !== 'weight'" />
            </div>
            <UButton
              icon="i-lucide-trash-2"
              variant="ghost"
              color="error"
              size="xs"
              aria-label="Remove serving"
              :disabled="servings.length === 1"
              @click="removeServing(index)"
            />
          </div>
          <NutritionServingPreview :draft="draft" />
        </div>
        <UButton label="Add serving" variant="soft" color="neutral" class="w-fit" @click="addServing" />
      </div>

      <UButton label="Create food" :disabled="!canSubmit" :loading="loading" class="w-full sm:w-fit" data-test="food-submit" @click="submit" />
    </div>
  </UCard>
</template>
