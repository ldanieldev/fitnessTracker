<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FoodDetail } from '~/types/nutrition'
import { errorMessage } from '~/utils/apiError'
import { keyNutrients } from '~~/shared/utils/nutritionKeyed'
import { hasMacro, sourceEnergyMismatch } from '~~/shared/utils/nutritionDerive'
import { energyMismatchMessage } from '~/utils/nutrition/energyMismatch'
import { barcodeHint } from '~/utils/nutrition/nameMatch'
import { EXTERNAL_SOURCE_LABELS } from '~/composables/useBarcodeLookup'
import {
  type ServingDraft,
  draftFromPer100g,
  draftFromServing,
  nutrientFields
} from '~/utils/nutrition/servingDraft'
import NutritionServingCard from '~/components/nutrition/NutritionServingCard.vue'

const props = defineProps<{ foodId: number }>()

const toast = useToast()

const fail = useFailToast()
const { tracked } = useTrackedNutrients()
const { idToKey } = useNutrientCatalog()
const fields = computed(() => nutrientFields(tracked.value ?? []))

type ServingCard = InstanceType<typeof NutritionServingCard>

const food = ref<FoodDetail | null>(null)
const notFound = ref(false)
const header = ref({ name: '', brand: '', barcode: '' })
const headerError = ref<string | null>(null)
const saving = ref(false)
const pendingCards = ref<number[]>([])
const pendingInitial = new Map<number, ServingDraft>()
const cards = shallowReactive(new Map<string, ServingCard>())
let pendingSeq = 0

const headerDirty = computed(
  () =>
    food.value !== null &&
    (header.value.name.trim() !== food.value.name ||
      header.value.brand.trim() !== (food.value.brand ?? '') ||
      header.value.barcode.trim() !== (food.value.barcode ?? ''))
)

const cardRows = computed(() => [
  ...(food.value?.servings ?? []).map((serving) => ({
    key: `serving-${serving.id}`,
    serving,
    pending: null,
    initial: undefined
  })),
  ...pendingCards.value.map((pending) => ({
    key: `pending-${pending}`,
    serving: null,
    pending,
    initial: pendingInitial.get(pending)
  }))
])

function setCard(key: string, card: unknown) {
  if (card) cards.set(key, card as ServingCard)
  else cards.delete(key)
}

const dirtyCards = computed(() => cardRows.value.filter((row) => cards.get(row.key)?.dirty))
const canSave = computed(
  () =>
    !saving.value &&
    header.value.name.trim().length > 0 &&
    (headerDirty.value || dirtyCards.value.length > 0) &&
    dirtyCards.value.every((row) => !cards.get(row.key)!.invalid)
)

async function load() {
  const keepHeader = headerDirty.value
  try {
    food.value = await apiFetch<FoodDetail>(`/api/nutrition/foods/${props.foodId}`)
    if (!keepHeader) {
      header.value = { name: food.value.name, brand: food.value.brand ?? '', barcode: food.value.barcode ?? '' }
    }
  } catch (err: unknown) {
    reportFailure(err, 'Load food')
    notFound.value = true
  }
}

onMounted(load)

const isCatalogue = computed(() => food.value?.createdByUserId === null)

const defaultServing = computed(() => {
  const servings = food.value?.servings ?? []
  return servings.find((s) => s.id === food.value?.defaultServingId) ?? servings[0] ?? null
})
const defaultDraft = computed(() =>
  defaultServing.value ? draftFromServing(defaultServing.value, idToKey.value) : null
)

function weightTaken(servingId: number | null) {
  return (food.value?.servings ?? []).some((s) => s.kind === 'weight' && s.id !== servingId)
}

async function saveHeader(): Promise<boolean> {
  headerError.value = null
  try {
    await apiFetch(`/api/nutrition/foods/${props.foodId}`, {
      method: 'PUT',
      body: {
        name: header.value.name.trim(),
        brand: header.value.brand.trim() || null,
        barcode: header.value.barcode.trim() || null
      }
    })
    return true
  } catch (err: unknown) {
    headerError.value = errorMessage(err, 'Could not save this food')
    return false
  }
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    let allSaved = headerDirty.value ? await saveHeader() : true
    let anySaved = allSaved && headerDirty.value
    for (const row of dirtyCards.value) {
      if (await cards.get(row.key)!.save()) {
        anySaved = true
        if (row.pending !== null) pendingCards.value = pendingCards.value.filter((k) => k !== row.pending)
      } else {
        allSaved = false
      }
    }
    if (anySaved) {
      await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
      await load()
    }
    if (allSaved) {
      energyWarning.value = null
      barcodeHeader.value = { name: null, brand: null }
      toast.add({ title: 'Food saved', color: 'success' })
    }
  } finally {
    saving.value = false
  }
}

async function fork() {
  try {
    const { id } = await apiFetch<{ id: number }>(`/api/nutrition/foods/${props.foodId}/fork`, { method: 'POST' })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    await navigateTo(`/nutrition/foods/${id}`, { replace: true })
  } catch (err: unknown) {
    fail('Copy failed', err, 'Could not copy this food')
  }
}

function addServing(initial?: ServingDraft) {
  pendingSeq += 1
  if (initial) pendingInitial.set(pendingSeq, initial)
  pendingCards.value = [...pendingCards.value, pendingSeq]
}

const prefill = useBarcodePrefill()
const energyWarning = ref<string | null>(null)
const barcodeHeader = ref<{ name: string | null; brand: string | null }>({ name: null, brand: null })
const nameHint = computed(() => barcodeHint(header.value.name, barcodeHeader.value.name))
const brandHint = computed(() => barcodeHint(header.value.brand, barcodeHeader.value.brand))

function applyHint(field: 'name' | 'brand') {
  const value = barcodeHeader.value[field]
  if (value) header.value[field] = value
}

async function onBarcodeScanned(code: string) {
  energyWarning.value = null
  barcodeHeader.value = { name: null, brand: null }
  const external = await prefill.find(code)
  if (!external) return
  let macroFilled = false
  let filled = prefill.fillHeader(header.value, external)
  barcodeHeader.value = { name: external.name || null, brand: external.brand }
  if (external.per100g) {
    for (const row of cardRows.value) {
      const keys = cards.get(row.key)?.fill(external.per100g) ?? []
      filled += keys.length
      if (hasMacro(keys)) macroFilled = true
    }
    if (!cardRows.value.some((row) => cards.get(row.key)?.isWeight)) {
      const weight = draftFromPer100g(external.per100g, fields.value)
      const keys = Object.keys(weight.nutrients)
      if (hasMacro(keys)) {
        addServing(weight)
        filled += keys.length
        macroFilled = true
      }
    }
    const mismatch = macroFilled ? sourceEnergyMismatch(external.per100g) : null
    energyWarning.value = mismatch ? energyMismatchMessage(mismatch, EXTERNAL_SOURCE_LABELS[external.source]) : null
  }
  prefill.report(filled, external)
}

const deleteOpen = ref(false)

async function confirmDelete() {
  try {
    await apiFetch(`/api/nutrition/foods/${props.foodId}`, { method: 'DELETE' })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    await navigateTo('/nutrition/foods')
  } catch (err: unknown) {
    fail('Delete failed', err, 'Could not delete this food')
  }
}

const logOpen = ref(false)

const menu = computed<DropdownMenuItem[][]>(() => {
  if (!food.value) return []
  const groups: DropdownMenuItem[][] = [
    [
      {
        label: 'Add to diary',
        icon: 'i-lucide-utensils',
        testId: 'food-add-to-diary',
        onSelect: () => {
          logOpen.value = true
        }
      }
    ]
  ]
  if (!isCatalogue.value) {
    groups.push([
      {
        label: 'Delete food',
        icon: 'i-lucide-trash-2',
        color: 'error',
        onSelect: () => {
          deleteOpen.value = true
        }
      }
    ])
  }
  return groups
})
</script>

<template>
  <UDashboardPanel id="nutrition-food">
    <template #header>
      <AppNavbar :title="food?.name ?? 'Food'" back="/nutrition/foods">
        <template #right>
          <UButton v-if="isCatalogue" label="Make my copy" size="sm" data-test="food-fork" @click="fork" />
          <AppMenuButton v-if="menu.length" :items="menu" label="Food actions" test-id="food-menu" />
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 max-w-3xl mx-auto w-full" :class="{ 'pb-28 lg:pb-0': food && !isCatalogue }">
        <UAlert v-if="notFound" color="error" variant="soft" title="Food not found" data-test="food-not-found" />

        <template v-else-if="food && isCatalogue">
          <UAlert
            v-if="food.source?.attributionRequired"
            color="neutral"
            variant="soft"
            :title="`Data from ${food.source.name}`"
            :description="food.source.licenseNotice ?? undefined"
          />
          <p class="text-sm text-dimmed">Catalogue foods are shared and read-only. Make your own copy to edit it.</p>
          <UCard v-for="serving in food.servings" :key="serving.id" data-test="catalogue-serving">
            <div class="flex flex-col gap-1 text-sm">
              <span class="font-medium"
                >{{ serving.quantity }} {{ serving.label
                }}<template v-if="serving.basisGrams && serving.kind === 'named'">
                  ({{ serving.basisGrams }} g)</template
                ></span
              >
              <NutritionMacroText
                v-if="serving.hasOwnNutrition"
                :nutrients="keyNutrients(serving.nutrients, idToKey)"
                with-energy
              />
              <span v-else class="text-dimmed">Derived from the gram weight</span>
            </div>
          </UCard>
        </template>

        <template v-else-if="food">
          <UCard>
            <div class="flex flex-col gap-3">
              <UFormField label="Name" required>
                <UInput v-model="header.name" autocapitalize="words" class="w-full" data-test="food-header-name" />
                <NutritionBarcodeSuggestion v-if="nameHint" :value="nameHint" field="name" @use="applyHint('name')" />
              </UFormField>
              <UFormField label="Brand">
                <UInput v-model="header.brand" autocapitalize="words" class="w-full" data-test="food-header-brand" />
                <NutritionBarcodeSuggestion
                  v-if="brandHint"
                  :value="brandHint"
                  field="brand"
                  @use="applyHint('brand')"
                />
              </UFormField>
              <NutritionBarcodeField
                v-model="header.barcode"
                input-test="food-header-barcode"
                @scanned="onBarcodeScanned"
              />
              <UAlert
                v-if="energyWarning"
                color="warning"
                variant="soft"
                :description="energyWarning"
                data-test="energy-mismatch"
              />
              <NutritionServingPreview v-if="defaultDraft" :draft="defaultDraft" />
              <p v-if="headerError" class="text-sm text-error" data-test="food-header-error">{{ headerError }}</p>
            </div>
          </UCard>

          <span class="font-medium">Servings</span>
          <NutritionServingCard
            v-for="row in cardRows"
            :key="row.key"
            :ref="(card) => setCard(row.key, card)"
            :food-id="food.id"
            :serving="row.serving"
            :fields="fields"
            :weight-taken="weightTaken(row.serving?.id ?? null)"
            :id-to-key="idToKey"
            :initial="row.initial"
            @deleted="load"
            @cancel="pendingCards = pendingCards.filter((k) => k !== row.pending)"
          />
          <UButton
            icon="i-lucide-plus"
            label="Add serving"
            variant="soft"
            class="w-full sm:w-fit"
            data-test="add-serving"
            @click="addServing()"
          />

          <div
            class="
              fixed inset-x-0 bottom-0 z-10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-default/95 border-t
              border-default lg:sticky lg:inset-x-auto lg:-bottom-6 lg:pb-4
            "
          >
            <UButton block label="Save" :loading="saving" :disabled="!canSave" data-test="food-save" @click="save" />
          </div>
        </template>
      </div>

      <NutritionLogFoodSheet v-if="food" v-model:open="logOpen" :food="food" />
      <AppSheet
        v-model:open="deleteOpen"
        title="Delete food"
        :description="`Delete ${food?.name}? Logged entries keep their numbers.`"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteOpen = false" />
            <UButton label="Delete" color="error" data-test="confirm-delete-food" @click="confirmDelete" />
          </div>
        </template>
      </AppSheet>
    </template>
  </UDashboardPanel>
</template>
