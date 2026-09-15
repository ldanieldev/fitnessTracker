<script setup lang="ts">
import type { DiaryEntry } from '~/composables/useDiaryDay'
import type { IngredientSnapshotItem } from '~~/shared/utils/nutritionRecipe'

const props = defineProps<{ entry: DiaryEntry, selectable?: boolean, selected?: boolean }>()
const emit = defineEmits<{ open: [], 'toggle-select': [] }>()

const ingredients = computed<IngredientSnapshotItem[]>(() =>
  props.entry.entryType === 'recipe' && Array.isArray(props.entry.ingredientSnapshot) ? props.entry.ingredientSnapshot as IngredientSnapshotItem[] : []
)
</script>

<template>
  <NutritionResultRow
    data-test="entry-row"
    :title="entry.description ?? ''"
    :amount-text="`${entry.quantity} ${entry.unitLabel}`"
    :nutrients="entry.nutrients"
    :energy="entry.nutrients.energy ?? null"
    macro-test-prefix="entry"
    :selectable="selectable"
    :selected="selected"
    checkbox-test="entry-select"
    :chevron="!selectable"
    @open="emit('open')"
    @toggle="emit('toggle-select')"
  >
    <template v-if="entry.entryType === 'recipe'" #default>
      <ul class="ps-6 text-xs text-dimmed" data-test="entry-ingredients">
        <li v-for="(ingredient, index) in ingredients" :key="index">{{ ingredient.name }} · {{ ingredient.quantity }} {{ ingredient.unitLabel }}</li>
      </ul>
    </template>
  </NutritionResultRow>
</template>
