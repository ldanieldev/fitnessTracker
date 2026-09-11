<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { type EditorLine, divideKeyed, linesPayload, loadEditorLines } from '~/utils/nutrition/lines'
import { errorMessage } from '~/utils/apiError'

interface RecipeDetail {
  id: number
  name: string
  servings: number
  servingName: string
  notes: string | null
  ingredients: Array<{ foodId: number, name: string | null, brand: string | null, quantity: number, unitLabel: string }>
}

const props = defineProps<{ recipeId: number | null }>()

const toast = useToast()
const router = useRouter()

const name = ref('')
const servings = ref(1)
const servingName = ref('serving')
const notes = ref('')

function snapshot(lines: EditorLine[]) {
  return JSON.stringify([name.value, servings.value, servingName.value, notes.value, linesPayload(lines)])
}

const {
  idToKey, lines, loaded, saving, baseline, total, hasBroken,
  pickerOpen, replaceUid, openPicker, onPicked,
  editingUid, editingLine, sheetOpen, onLineUpdate, onLineRemove,
  deleteOpen
} = useLibraryEditor(snapshot, props.recipeId === null)

onMounted(async () => {
  if (props.recipeId !== null) {
    try {
      const recipe = await $fetch<RecipeDetail>(`/api/nutrition/recipes/${props.recipeId}`)
      name.value = recipe.name
      servings.value = recipe.servings
      servingName.value = recipe.servingName
      notes.value = recipe.notes ?? ''
      lines.value = await loadEditorLines(recipe.ingredients)
    } catch (error: unknown) {
      toast.add({ title: 'Load failed', description: errorMessage(error, 'Could not load this recipe'), color: 'error' })
    }
  }
  baseline.value = snapshot(lines.value)
  loaded.value = true
})

const perServing = computed(() => (servings.value > 0 ? divideKeyed(total.value, servings.value) : null))
const canSave = computed(() =>
  name.value.trim().length > 0 && servings.value > 0 && servingName.value.trim().length > 0
  && lines.value.length > 0 && !hasBroken.value && !saving.value
)

async function save() {
  if (!canSave.value) return
  saving.value = true
  const body = {
    name: name.value.trim(),
    servings: servings.value,
    servingName: servingName.value.trim(),
    notes: notes.value.trim() || null,
    ingredients: linesPayload(lines.value)
  }
  try {
    if (props.recipeId === null) {
      const { id } = await $fetch<{ id: number }>('/api/nutrition/recipes', { method: 'POST', body })
      baseline.value = snapshot(lines.value)
      await router.replace(`/nutrition/recipes/${id}`)
    } else {
      await $fetch(`/api/nutrition/recipes/${props.recipeId}`, { method: 'PUT', body })
      baseline.value = snapshot(lines.value)
      toast.add({ title: 'Recipe saved', color: 'success' })
    }
  } catch (error: unknown) {
    toast.add({ title: 'Save failed', description: errorMessage(error, 'Could not save this recipe'), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function confirmDelete() {
  try {
    await $fetch(`/api/nutrition/recipes/${props.recipeId}`, { method: 'DELETE' })
    baseline.value = snapshot(lines.value)
    await navigateTo('/nutrition/recipes')
  } catch (error: unknown) {
    toast.add({ title: 'Delete failed', description: errorMessage(error, 'Could not delete this recipe'), color: 'error' })
  }
}

const menu = computed<DropdownMenuItem[][]>(() =>
  props.recipeId === null ? [] : [[{ label: 'Delete recipe', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => { deleteOpen.value = true } }]]
)
</script>

<template>
  <UDashboardPanel id="nutrition-recipe">
    <template #header>
      <UDashboardNavbar :title="recipeId === null ? 'New recipe' : 'Recipe'">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UDropdownMenu v-if="menu.length" :items="menu">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" aria-label="Recipe actions" data-test="recipe-menu" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="loaded" class="flex flex-col gap-4 max-w-2xl mx-auto w-full pb-24">
        <UFormField label="Name" required>
          <UInput v-model="name" class="w-full" data-test="recipe-name" />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Servings" required>
            <UInputNumber v-model="servings" :min="0" :step="0.5" class="w-full" data-test="recipe-servings" />
          </UFormField>
          <UFormField label="Serving name" required>
            <UInput v-model="servingName" class="w-full" data-test="recipe-serving-name" />
          </UFormField>
        </div>

        <div class="flex items-center justify-between">
          <span class="font-medium">Ingredients</span>
          <UButton icon="i-lucide-plus" label="Add ingredients" variant="soft" size="sm" data-test="add-ingredients" @click="openPicker(null)" />
        </div>
        <NutritionIngredientList :lines="lines" :id-to-key="idToKey" @edit="(uid) => (editingUid = uid)" />
        <UAlert v-if="hasBroken" color="error" variant="soft" title="Remove or replace unavailable ingredients to save" />

        <NutritionTotalsPanel :total="total" :per-serving="perServing" :serving-name="servingName" />

        <UFormField label="Notes">
          <UTextarea v-model="notes" :rows="3" class="w-full" data-test="recipe-notes" />
        </UFormField>

        <div class="fixed inset-x-0 bottom-0 z-10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-default/95 border-t border-default lg:static lg:border-0 lg:bg-transparent">
          <UButton block label="Save recipe" :loading="saving" :disabled="!canSave" data-test="recipe-save" @click="save" />
        </div>
      </div>

      <NutritionPickerSheet v-model:open="pickerOpen" :multiple="replaceUid === null" :title="replaceUid ? 'Replace ingredient' : 'Add ingredients'" @confirm="onPicked" />
      <NutritionIngredientSheet v-model:open="sheetOpen" :line="editingLine" @update="onLineUpdate" @remove="onLineRemove" @replace="openPicker" />

      <NutritionSheet v-model:open="deleteOpen" title="Delete recipe" :description="`Delete ${name}? Logged entries keep their numbers.`">
        <template #footer>
          <div class="flex w-full justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteOpen = false" />
            <UButton label="Delete" color="error" data-test="confirm-delete-recipe" @click="confirmDelete" />
          </div>
        </template>
      </NutritionSheet>
    </template>
  </UDashboardPanel>
</template>
