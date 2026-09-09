<script setup lang="ts">
import { NUTRITION_MACROS } from '~/constants/nutrition'
import type { DiaryEntry } from '~/composables/useDiaryDay'
import type { IngredientSnapshotItem } from '~~/shared/utils/nutritionRecipe'

const props = defineProps<{
  entry: DiaryEntry
  selectable?: boolean
  selected?: boolean
}>()

defineEmits<{
  delete: []
  copy: []
  'toggle-select': []
}>()

const expanded = ref(false)

const ingredients = computed<IngredientSnapshotItem[]>(() => {
  if (props.entry.entryType !== 'recipe' || !Array.isArray(props.entry.ingredientSnapshot)) return []
  return props.entry.ingredientSnapshot as IngredientSnapshotItem[]
})
</script>

<template>
  <div class="flex flex-col gap-1 py-2 px-3 rounded-lg bg-elevated/50 text-sm" data-test="entry-row">
    <div class="flex items-center gap-3">
      <UCheckbox
        v-if="selectable"
        :model-value="selected ?? false"
        data-test="entry-select"
        @update:model-value="$emit('toggle-select')"
      />
      <UButton
        v-if="entry.entryType === 'recipe'"
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        variant="ghost"
        color="neutral"
        size="xs"
        @click="expanded = !expanded"
      />
      <span class="font-medium">{{ entry.description }}</span>
      <span class="text-dimmed">{{ entry.quantity }} {{ entry.unitLabel }}</span>
      <span v-for="macro in NUTRITION_MACROS" :key="macro.key" :data-test="`entry-${macro.key}`" class="text-dimmed">
        {{ (entry.nutrients[macro.key] ?? 0).toFixed(1) }} {{ macro.unit }}
      </span>
      <UButton
        icon="i-lucide-copy"
        variant="ghost"
        color="neutral"
        size="xs"
        class="ml-auto"
        aria-label="Copy entry"
        data-test="entry-copy"
        @click="$emit('copy')"
      />
      <UButton
        icon="i-lucide-trash-2"
        variant="ghost"
        color="error"
        size="xs"
        @click="$emit('delete')"
      />
    </div>
    <div v-if="expanded" class="flex flex-col gap-1 pl-8 text-dimmed">
      <div v-for="(ingredient, index) in ingredients" :key="index">
        {{ ingredient.name }} — {{ ingredient.quantity }} {{ ingredient.unitLabel }}
      </div>
    </div>
  </div>
</template>
