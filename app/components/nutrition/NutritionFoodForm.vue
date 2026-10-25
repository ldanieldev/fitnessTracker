<script setup lang="ts">
import type { NutrientKey } from '~~/shared/types/nutrition'
import type { ServingDraft } from '~/utils/nutrition/servingDraft'
import {
  emptyDraft,
  nutrientFields,
  draftToInput,
  applyParsedNutrients,
  draftError,
  draftFromPer100g,
  fillDraftFromPer100g
} from '~/utils/nutrition/servingDraft'
import { useTrackedNutrients } from '~/composables/useTrackedNutrients'
import { EXTERNAL_SOURCE_LABELS } from '~/composables/useBarcodeLookup'
import { energyMismatchMessage } from '~/utils/nutrition/energyMismatch'
import { barcodeHint } from '~/utils/nutrition/nameMatch'
import { hasMacro, sourceEnergyMismatch } from '~~/shared/utils/nutritionDerive'

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

const fail = useFailToast()
const toast = useToast()
const { tracked } = useTrackedNutrients()

const name = ref(props.prefill?.name ?? '')
const brand = ref(props.prefill?.brand ?? '')
const barcode = ref(props.prefill?.barcode ?? '')
const loading = ref(false)
const showOcr = ref(false)
const energyWarning = ref<string | null>(null)
const barcodeHeader = ref<{ name: string | null; brand: string | null }>({ name: null, brand: null })
const nameHint = computed(() => barcodeHint(name.value, barcodeHeader.value.name))
const brandHint = computed(() => barcodeHint(brand.value, barcodeHeader.value.brand))

const servings = ref<ServingDraft[]>(
  props.prefill?.servings?.length
    ? props.prefill.servings.map((draft) => ({ ...emptyDraft(), ...draft }))
    : [emptyDraft()]
)

const fields = computed(() => nutrientFields(tracked.value ?? []))

function applyParsedLabel(result: ParsedLabel) {
  const mismatch = sourceEnergyMismatch(result.nutrients)
  energyWarning.value = mismatch ? energyMismatchMessage(mismatch, null) : null
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

const barcodePrefill = useBarcodePrefill()

function applyHint(field: 'name' | 'brand') {
  const value = barcodeHeader.value[field]
  if (!value) return
  if (field === 'name') name.value = value
  else brand.value = value
}

async function onBarcodeScanned(code: string) {
  energyWarning.value = null
  barcodeHeader.value = { name: null, brand: null }
  const external = await barcodePrefill.find(code)
  if (!external) return
  let macroFilled = false
  const header = { name: name.value, brand: brand.value }
  let filled = barcodePrefill.fillHeader(header, external)
  name.value = header.name
  brand.value = header.brand
  barcodeHeader.value = { name: external.name || null, brand: external.brand }
  const per100g = external.per100g
  if (per100g) {
    servings.value = servings.value.map((draft) => {
      const result = fillDraftFromPer100g(draft, per100g, fields.value)
      filled += result.filledKeys.length
      if (hasMacro(result.filledKeys)) macroFilled = true
      return result.draft
    })
    if (!servings.value.some((d) => d.kind === 'weight')) {
      const weight = draftFromPer100g(per100g, fields.value)
      const keys = Object.keys(weight.nutrients)
      if (hasMacro(keys)) {
        const untouched = JSON.stringify(emptyDraft())
        servings.value = [weight, ...servings.value.filter((d) => JSON.stringify(d) !== untouched)]
        filled += keys.length
        macroFilled = true
      }
    }
    const mismatch = macroFilled ? sourceEnergyMismatch(per100g) : null
    energyWarning.value = mismatch ? energyMismatchMessage(mismatch, EXTERNAL_SOURCE_LABELS[external.source]) : null
  }
  barcodePrefill.report(filled, external)
}

function removeServing(index: number) {
  if (servings.value.length > 1) servings.value.splice(index, 1)
}

const weightTaken = computed(() => servings.value.some((d) => d.kind === 'weight'))

const canSubmit = computed(
  () =>
    name.value.trim().length > 0 &&
    servings.value.filter((s) => s.kind === 'weight').length <= 1 &&
    servings.value.every((d) => !draftError(d))
)

async function submit() {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const result = await apiFetch<{ id: number }>('/api/nutrition/foods', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        brand: brand.value.trim() || undefined,
        barcode: barcode.value.trim() || undefined,
        servings: servings.value.map(draftToInput)
      }
    })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    toast.add({ title: 'Food created', color: 'success' })
    emit('created', result.id)
  } catch (err: unknown) {
    fail('Failed to create food', err, 'Could not create food')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="pb-28 lg:pb-0">
    <UCard>
      <div class="flex flex-col gap-4">
        <UFormField label="Name" required>
          <UInput v-model="name" autocapitalize="words" class="w-full" data-test="food-name" />
          <NutritionBarcodeSuggestion v-if="nameHint" :value="nameHint" field="name" @use="applyHint('name')" />
        </UFormField>
        <UFormField label="Brand">
          <UInput v-model="brand" autocapitalize="words" class="w-full" data-test="food-brand" />
          <NutritionBarcodeSuggestion v-if="brandHint" :value="brandHint" field="brand" @use="applyHint('brand')" />
        </UFormField>
        <NutritionBarcodeField v-model="barcode" input-test="food-barcode" @scanned="onBarcodeScanned" />
        <UAlert
          v-if="energyWarning"
          color="warning"
          variant="soft"
          :description="energyWarning"
          data-test="energy-mismatch"
        />

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
          <div
            v-for="(draft, index) in servings"
            :key="index"
            class="flex flex-col gap-2 p-3 rounded-lg bg-elevated/50"
          >
            <div class="flex gap-2 items-center justify-between">
              <div class="flex-1">
                <NutritionServingFields
                  v-model="servings[index]!"
                  :fields="fields"
                  :weight-taken="weightTaken && draft.kind !== 'weight'"
                />
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
      </div>
    </UCard>
    <div
      class="
        fixed inset-x-0 bottom-0 z-10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-default/95 border-t
        border-default lg:sticky lg:inset-x-auto lg:-bottom-6 lg:pb-4
      "
    >
      <UButton
        block
        label="Create food"
        :disabled="!canSubmit"
        :loading="loading"
        data-test="food-submit"
        @click="submit"
      />
    </div>
  </div>
</template>
