<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { FoodDetail } from '~/types/nutrition'
import { errorMessage } from '~/utils/apiError'
import { keyNutrients } from '~~/shared/utils/nutritionKeyed'
import { draftFromServing, nutrientFields } from '~/utils/nutrition/servingDraft'

const props = defineProps<{ foodId: number }>()

const toast = useToast()
const backOrTo = useBackOrTo()
const { tracked } = useTrackedNutrients()
const { idToKey } = useNutrientCatalog()
const fields = computed(() => nutrientFields(tracked.value ?? []))

const food = ref<FoodDetail | null>(null)
const notFound = ref(false)
const header = ref({ name: '', brand: '', barcode: '' })
const headerError = ref<string | null>(null)
const headerSaving = ref(false)
const pendingCards = ref<number[]>([])
let pendingSeq = 0

async function load() {
  try {
    food.value = await $fetch<FoodDetail>(`/api/nutrition/foods/${props.foodId}`)
    header.value = { name: food.value.name, brand: food.value.brand ?? '', barcode: food.value.barcode ?? '' }
  } catch {
    notFound.value = true
  }
}

onMounted(load)

const isCatalogue = computed(() => food.value?.createdByUserId === null)

const defaultServing = computed(() => {
  const servings = food.value?.servings ?? []
  return servings.find((s) => s.id === food.value?.defaultServingId) ?? servings[0] ?? null
})
const defaultDraft = computed(() => (defaultServing.value ? draftFromServing(defaultServing.value, idToKey.value) : null))

function weightTaken(servingId: number | null) {
  return (food.value?.servings ?? []).some((s) => s.kind === 'weight' && s.id !== servingId)
}

async function saveHeader() {
  headerSaving.value = true
  headerError.value = null
  try {
    await $fetch(`/api/nutrition/foods/${props.foodId}`, {
      method: 'PUT',
      body: { name: header.value.name.trim(), brand: header.value.brand.trim() || null, barcode: header.value.barcode.trim() || null }
    })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    toast.add({ title: 'Food saved', color: 'success' })
    await backOrTo('/nutrition/foods')
  } catch (err: unknown) {
    headerError.value = errorMessage(err, 'Could not save this food')
  } finally {
    headerSaving.value = false
  }
}

async function fork() {
  try {
    const { id } = await $fetch<{ id: number }>(`/api/nutrition/foods/${props.foodId}/fork`, { method: 'POST' })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    await navigateTo(`/nutrition/foods/${id}`, { replace: true })
  } catch (err: unknown) {
    toast.add({ title: 'Copy failed', description: errorMessage(err, 'Could not copy this food'), color: 'error' })
  }
}

function addServing() {
  pendingSeq += 1
  pendingCards.value = [...pendingCards.value, pendingSeq]
}

async function onPendingSaved(key: number) {
  pendingCards.value = pendingCards.value.filter((k) => k !== key)
  await load()
}

const deleteOpen = ref(false)

async function confirmDelete() {
  try {
    await $fetch(`/api/nutrition/foods/${props.foodId}`, { method: 'DELETE' })
    await invalidateNutrition(NUTRITION_KEYS.foods, NUTRITION_KEYS.recipes, NUTRITION_KEYS.savedMeals)
    await navigateTo('/nutrition/foods')
  } catch (err: unknown) {
    toast.add({ title: 'Delete failed', description: errorMessage(err, 'Could not delete this food'), color: 'error' })
  }
}

const menu = computed<DropdownMenuItem[][]>(() =>
  food.value && !isCatalogue.value
    ? [[{ label: 'Delete food', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { deleteOpen.value = true } }]]
    : []
)
</script>

<template>
  <UDashboardPanel id="nutrition-food">
    <template #header>
      <UDashboardNavbar :title="food?.name ?? 'Food'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="isCatalogue" label="Make my copy" size="sm" data-test="food-fork" @click="fork" />
          <UDropdownMenu v-else-if="menu.length" :items="menu">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Food actions" data-test="food-menu" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 max-w-2xl mx-auto w-full">
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
              <span class="font-medium">{{ serving.quantity }} {{ serving.label }}<template v-if="serving.basisGrams && serving.kind === 'named'"> ({{ serving.basisGrams }} g)</template></span>
              <NutritionMacroText v-if="serving.hasOwnNutrition" :nutrients="keyNutrients(serving.nutrients, idToKey)" with-energy />
              <span v-else class="text-dimmed">Derived from the gram weight</span>
            </div>
          </UCard>
        </template>

        <template v-else-if="food">
          <UCard>
            <div class="flex flex-col gap-3">
              <UFormField label="Name" required>
                <UInput v-model="header.name" class="w-full" data-test="food-header-name" />
              </UFormField>
              <UFormField label="Brand">
                <UInput v-model="header.brand" class="w-full" data-test="food-header-brand" />
              </UFormField>
              <UFormField label="Barcode">
                <UInput v-model="header.barcode" inputmode="numeric" class="w-full" data-test="food-header-barcode" />
              </UFormField>
              <NutritionServingPreview v-if="defaultDraft" :draft="defaultDraft" />
              <p v-if="headerError" class="text-sm text-error" data-test="food-header-error">{{ headerError }}</p>
              <UButton label="Save" class="w-full sm:w-fit" :loading="headerSaving" :disabled="!header.name.trim()" data-test="food-header-save" @click="saveHeader" />
            </div>
          </UCard>

          <span class="font-medium">Servings</span>
          <NutritionServingCard
            v-for="serving in food.servings"
            :key="serving.id"
            :food-id="food.id"
            :serving="serving"
            :fields="fields"
            :weight-taken="weightTaken(serving.id)"
            :id-to-key="idToKey"
            @saved="load"
            @deleted="load"
          />
          <NutritionServingCard
            v-for="key in pendingCards"
            :key="`pending-${key}`"
            :food-id="food.id"
            :serving="null"
            :fields="fields"
            :weight-taken="weightTaken(null)"
            :id-to-key="idToKey"
            @saved="onPendingSaved(key)"
            @cancel="pendingCards = pendingCards.filter((k) => k !== key)"
          />
          <UButton icon="i-lucide-plus" label="Add serving" variant="soft" class="w-full sm:w-fit" data-test="add-serving" @click="addServing" />
        </template>
      </div>

      <NutritionSheet v-model:open="deleteOpen" title="Delete food" :description="`Delete ${food?.name}? Logged entries keep their numbers.`">
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteOpen = false" />
            <UButton label="Delete" color="error" data-test="confirm-delete-food" @click="confirmDelete" />
          </div>
        </template>
      </NutritionSheet>
    </template>
  </UDashboardPanel>
</template>
