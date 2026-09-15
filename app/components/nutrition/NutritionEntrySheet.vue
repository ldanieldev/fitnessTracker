<script setup lang="ts">
import type { DiaryEntry, DiaryEntryPatch } from '~/composables/useDiaryDay'
import type { FoodDetail } from '~/types/nutrition'
import { type EntryDraft, draftFromEntry, entryPatch, scaledPreview } from '~/utils/nutrition/entryEdit'
import { resolveByLabel } from '~/utils/nutrition/resolveByLabel'
import { keyNutrients } from '~~/shared/utils/nutritionKeyed'

const props = defineProps<{ entry: DiaryEntry | null, containers: Array<{ id: number, name: string }> }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [id: number, patch: DiaryEntryPatch], delete: [id: number], copy: [id: number] }>()

const { idToKey } = useNutrientCatalog()
const containerItems = useContainerItems(() => props.containers)

const draft = ref<EntryDraft | null>(null)
const food = ref<FoodDetail | null>(null)
const foodMissing = ref(false)
const confirmingDelete = ref(false)

watch(() => props.entry, async (value) => {
  draft.value = value ? draftFromEntry(value) : null
  food.value = null
  foodMissing.value = false
  confirmingDelete.value = false
  if (value?.entryType === 'food' && value.foodId !== null) {
    try {
      food.value = await apiFetch<FoodDetail>(`/api/nutrition/foods/${value.foodId}`)
    } catch {
      foodMissing.value = true
    }
  }
}, { immediate: true })

const showUnit = computed(() => props.entry?.entryType === 'food')

const preview = computed<Record<string, number>>(() => {
  const entry = props.entry
  const current = draft.value
  if (!entry || !current) return {}
  if (showUnit.value && food.value && current.unitLabel !== entry.unitLabel) {
    const byId = resolveByLabel(food.value, current.unitLabel, current.quantity)
    return byId ? keyNutrients(byId, idToKey.value) : {}
  }
  return scaledPreview(entry.nutrients, entry.quantity, current.quantity)
})

const patch = computed(() => (props.entry && draft.value ? entryPatch(props.entry, draft.value) : {}))
const canSave = computed(() => (draft.value?.quantity ?? 0) > 0 && Object.keys(patch.value).length > 0)

function save() {
  if (!props.entry || !canSave.value) return
  emit('save', props.entry.id, patch.value)
  open.value = false
}
</script>

<template>
  <NutritionSheet v-model:open="open" :title="entry?.description ?? 'Entry'">
    <template #body>
      <div v-if="entry && draft" class="flex flex-col gap-3">
        <NutritionAmountInput
          v-if="showUnit && food"
          :model-value="{ quantity: draft.quantity, unitLabel: draft.unitLabel }"
          :food="food"
          quantity-test="entry-sheet-quantity"
          unit-test="entry-sheet-unit"
          @update:model-value="(value) => draft && Object.assign(draft, value)"
        />
        <div v-else class="grid grid-cols-2 gap-2">
          <UFormField label="Quantity">
            <NutritionNumberInput v-model="draft.quantity" :min="0" :step="0.5" class="w-full" data-test="entry-sheet-quantity" />
          </UFormField>
          <UFormField v-if="showUnit" label="Unit">
            <USelect :model-value="draft.unitLabel" :items="[draft.unitLabel]" disabled class="w-full" data-test="entry-sheet-unit" />
          </UFormField>
        </div>
        <UFormField label="Meal">
          <USelect v-model="draft.containerId" :items="containerItems" class="w-full" data-test="entry-sheet-container" />
        </UFormField>
        <UFormField label="Note">
          <UTextarea v-model="draft.notes" :rows="2" :maxlength="2000" class="w-full" data-test="entry-sheet-notes" />
        </UFormField>
        <NutritionMacroText :nutrients="preview" with-energy data-test="entry-sheet-preview" />
        <p v-if="foodMissing" class="text-xs text-dimmed">This food was deleted, so only the amount can change.</p>
        <div v-if="!confirmingDelete" class="flex w-full gap-2">
          <UButton icon="i-lucide-trash-2" color="error" variant="soft" aria-label="Delete entry" data-test="entry-delete" @click="confirmingDelete = true" />
          <UButton icon="i-lucide-copy" color="neutral" variant="soft" label="Copy" data-test="entry-copy" @click="emit('copy', entry.id); open = false" />
          <UButton label="Save" class="ml-auto" :disabled="!canSave" data-test="entry-save" @click="save" />
        </div>
      </div>
    </template>
    <template v-if="entry && confirmingDelete" #footer>
      <div class="flex w-full gap-2">
        <UButton label="Cancel" color="neutral" variant="outline" @click="confirmingDelete = false" />
        <UButton label="Delete entry" color="error" class="ml-auto" data-test="entry-delete-confirm" @click="emit('delete', entry.id); open = false" />
      </div>
    </template>
  </NutritionSheet>
</template>
