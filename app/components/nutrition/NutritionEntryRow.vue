<script setup lang="ts">
import type { DiaryEntry } from '~/composables/useDiaryDay'
import type { IngredientSnapshotItem } from '~~/shared/utils/nutritionRecipe'

const props = defineProps<{ entry: DiaryEntry, selectable?: boolean, selected?: boolean }>()
const emit = defineEmits<{ open: [], 'toggle-select': [] }>()

const expanded = ref(false)
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
    <template #actions>
      <UButton
        v-if="entry.entryType === 'recipe'"
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        variant="ghost"
        color="neutral"
        size="xs"
        aria-label="Show ingredients"
        @click.stop="expanded = !expanded"
      />
    </template>
    <template v-if="expanded" #default>
      <div class="flex flex-col gap-1 text-xs text-dimmed">
        <div v-for="(ingredient, index) in ingredients" :key="index">{{ ingredient.name }} — {{ ingredient.quantity }} {{ ingredient.unitLabel }}</div>
      </div>
    </template>
  </NutritionResultRow>
</template>
