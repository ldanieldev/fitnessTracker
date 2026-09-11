<script setup lang="ts">
import type { DiaryEntry } from '~/composables/useDiaryDay'
import type { IngredientSnapshotItem } from '~~/shared/utils/nutritionRecipe'

const props = defineProps<{ entry: DiaryEntry, selectable?: boolean, selected?: boolean }>()
const emit = defineEmits<{ open: [], 'toggle-select': [] }>()

const expanded = ref(false)
const ingredients = computed<IngredientSnapshotItem[]>(() =>
  props.entry.entryType === 'recipe' && Array.isArray(props.entry.ingredientSnapshot) ? props.entry.ingredientSnapshot as IngredientSnapshotItem[] : []
)
const n = (key: string) => props.entry.nutrients[key] ?? 0

function onTap() {
  if (props.selectable) emit('toggle-select')
  else emit('open')
}
</script>

<template>
  <div class="rounded-lg bg-elevated/50 text-sm" data-test="entry-row">
    <div class="flex items-center gap-2 p-3 min-h-12 cursor-pointer" role="button" tabindex="0" @click="onTap" @keydown.enter="onTap">
      <UCheckbox v-if="selectable" :model-value="selected ?? false" data-test="entry-select" @click.stop @update:model-value="emit('toggle-select')" />
      <UButton
        v-if="entry.entryType === 'recipe'"
        :icon="expanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        variant="ghost"
        color="neutral"
        size="xs"
        aria-label="Show ingredients"
        @click.stop="expanded = !expanded"
      />
      <div class="flex flex-col min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span class="font-medium truncate flex-1">{{ entry.description }}</span>
          <span data-test="entry-energy" class="shrink-0">{{ n('energy').toFixed(0) }} kcal</span>
        </div>
        <div class="flex gap-2 text-xs text-dimmed">
          <span>{{ entry.quantity }} {{ entry.unitLabel }}</span>
          <span data-test="entry-protein">P {{ n('protein').toFixed(1) }}</span>
          <span data-test="entry-carbohydrate">C {{ n('carbohydrate').toFixed(1) }}</span>
          <span data-test="entry-fat">F {{ n('fat').toFixed(1) }}</span>
        </div>
      </div>
    </div>
    <div v-if="expanded" class="flex flex-col gap-1 px-3 pb-3 pl-12 text-xs text-dimmed">
      <div v-for="(ingredient, index) in ingredients" :key="index">{{ ingredient.name }} — {{ ingredient.quantity }} {{ ingredient.unitLabel }}</div>
    </div>
  </div>
</template>
