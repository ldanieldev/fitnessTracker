<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { type EditorLine, linesPayload, loadEditorLines } from '~/utils/nutrition/lines'

interface SavedMealDetail {
  name: string
  items: Array<{ foodId: number; name: string | null; brand: string | null; quantity: number; unitLabel: string }>
}

const props = defineProps<{ savedMealId: number | null }>()

const toast = useToast()

const fail = useFailToast()
const backOrTo = useBackOrTo()

const name = ref('')
const savedName = ref('')

function snapshot(lines: EditorLine[]) {
  return JSON.stringify([name.value, linesPayload(lines)])
}

const {
  idToKey,
  lines,
  loaded,
  saving,
  baseline,
  total,
  hasBroken,
  pickerOpen,
  replaceUid,
  openPicker,
  onPicked,
  editingUid,
  editingLine,
  sheetOpen,
  onLineUpdate,
  onLineRemove,
  deleteOpen
} = useLibraryEditor(snapshot, props.savedMealId === null)

onMounted(async () => {
  if (props.savedMealId !== null) {
    try {
      const meal = await apiFetch<SavedMealDetail>(`/api/nutrition/saved-meals/${props.savedMealId}`)
      name.value = meal.name
      savedName.value = meal.name
      lines.value = await loadEditorLines(meal.items)
    } catch (error: unknown) {
      fail('Load failed', error, 'Could not load this saved meal')
    }
  }
  baseline.value = snapshot(lines.value)
  loaded.value = true
})

const canSave = computed(
  () => name.value.trim().length > 0 && lines.value.length > 0 && !hasBroken.value && !saving.value
)

async function save() {
  if (!canSave.value) return
  saving.value = true
  const body = { name: name.value.trim(), items: linesPayload(lines.value) }
  try {
    if (props.savedMealId === null) {
      await apiFetch<{ id: number }>('/api/nutrition/saved-meals', { method: 'POST', body })
      baseline.value = snapshot(lines.value)
      savedName.value = body.name
      await invalidateNutrition(NUTRITION_KEYS.savedMeals)
      await backOrTo('/nutrition/saved-meals')
    } else {
      await apiFetch(`/api/nutrition/saved-meals/${props.savedMealId}`, { method: 'PUT', body })
      baseline.value = snapshot(lines.value)
      savedName.value = body.name
      await invalidateNutrition(NUTRITION_KEYS.savedMeals)
      toast.add({ title: 'Saved meal saved', color: 'success' })
      await backOrTo('/nutrition/saved-meals')
    }
  } catch (error: unknown) {
    fail('Save failed', error, 'Could not save this meal')
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  try {
    await apiFetch(`/api/nutrition/saved-meals/${props.savedMealId}`, { method: 'DELETE' })
    baseline.value = snapshot(lines.value)
    await invalidateNutrition(NUTRITION_KEYS.savedMeals)
    await navigateTo('/nutrition/saved-meals')
  } catch (error: unknown) {
    fail('Delete failed', error, 'Could not delete this saved meal')
  }
}

const menu = computed<DropdownMenuItem[][]>(() =>
  props.savedMealId === null
    ? []
    : [
        [
          {
            label: 'Delete saved meal',
            icon: 'i-lucide-trash-2',
            color: 'error',
            onSelect: () => {
              deleteOpen.value = true
            }
          }
        ]
      ]
)
</script>

<template>
  <UDashboardPanel id="nutrition-saved-meal">
    <template #header>
      <AppNavbar
        :title="savedName || (savedMealId === null ? 'New saved meal' : 'Saved meal')"
        back="/nutrition/saved-meals"
      >
        <template #right>
          <AppMenuButton v-if="menu.length" :items="menu" label="Saved meal actions" test-id="meal-menu" />
        </template>
      </AppNavbar>
    </template>

    <template #body>
      <div v-if="loaded" class="flex flex-col gap-6 max-w-3xl mx-auto w-full pb-28 lg:pb-0">
        <UFormField label="Name" required>
          <UInput v-model="name" class="w-full" data-test="meal-name" />
        </UFormField>

        <div class="flex items-center justify-between">
          <span class="font-medium">Ingredients</span>
          <UButton
            icon="i-lucide-plus"
            label="Add ingredients"
            variant="soft"
            size="sm"
            data-test="add-ingredients"
            @click="openPicker(null)"
          />
        </div>
        <NutritionIngredientList :lines="lines" :id-to-key="idToKey" @edit="(uid) => (editingUid = uid)" />
        <UAlert
          v-if="hasBroken"
          color="error"
          variant="soft"
          title="Remove or replace unavailable ingredients to save"
        />

        <NutritionTotalsPanel :total="total" />

        <div
          class="
            fixed inset-x-0 bottom-0 z-10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-default/95 border-t
            border-default lg:sticky lg:inset-x-auto lg:-bottom-6 lg:pb-4
          "
        >
          <UButton block label="Save meal" :loading="saving" :disabled="!canSave" data-test="meal-save" @click="save" />
        </div>
      </div>

      <NutritionPickerSheet
        v-model:open="pickerOpen"
        :multiple="replaceUid === null"
        :title="replaceUid ? 'Replace ingredient' : 'Add ingredients'"
        @confirm="onPicked"
      />
      <NutritionIngredientSheet
        v-model:open="sheetOpen"
        :line="editingLine"
        @update="onLineUpdate"
        @remove="onLineRemove"
        @replace="openPicker"
      />

      <AppSheet
        v-model:open="deleteOpen"
        title="Delete saved meal"
        :description="`Delete ${name}? Logged entries keep their numbers.`"
      >
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteOpen = false" />
            <UButton label="Delete" color="error" data-test="confirm-delete-meal" @click="confirmDelete" />
          </div>
        </template>
      </AppSheet>
    </template>
  </UDashboardPanel>
</template>
