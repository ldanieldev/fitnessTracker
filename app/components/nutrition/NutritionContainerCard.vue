<script setup lang="ts">
import { NUTRITION_MACROS } from '~/constants/nutrition'
import type { DiaryContainer } from '~/composables/useDiaryDay'

interface SubtotalNutrient {
  key: string
  name: string
  unit: string
}

const props = defineProps<{
  container: DiaryContainer
  nutrients?: SubtotalNutrient[]
  selectable?: boolean
  selectedIds?: Set<number>
}>()

defineEmits<{
  'delete-entry': [id: number]
  'copy-entry': [id: number]
  'copy-container': [id: number]
  'toggle-entry': [id: number]
}>()

const subtotals = computed(() => {
  const list: readonly SubtotalNutrient[] = props.nutrients?.length ? props.nutrients : NUTRITION_MACROS
  return list.map((nutrient) => ({ ...nutrient, value: props.container.subtotals[nutrient.key] ?? 0 }))
})
</script>

<template>
  <UCard :data-test="`container-${container.id}`">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="font-medium">{{ container.name }}</span>
        <UButton
          icon="i-lucide-copy"
          variant="ghost"
          color="neutral"
          size="xs"
          aria-label="Copy meal"
          data-test="copy-container"
          @click="$emit('copy-container', container.id)"
        />
      </div>
    </template>

    <div class="flex flex-col gap-2">
      <p v-if="container.entries.length === 0" class="text-sm text-dimmed">No entries yet</p>
      <NutritionEntryRow
        v-for="entry in container.entries"
        :key="entry.id"
        :entry="entry"
        :selectable="selectable"
        :selected="selectedIds?.has(entry.id) ?? false"
        @delete="$emit('delete-entry', entry.id)"
        @copy="$emit('copy-entry', entry.id)"
        @toggle-select="$emit('toggle-entry', entry.id)"
      />
    </div>

    <template #footer>
      <div class="flex gap-4 text-sm text-dimmed">
        <span v-for="nutrient in subtotals" :key="nutrient.key" :data-test="`subtotal-${nutrient.key}`">
          {{ nutrient.value.toFixed(1) }} {{ nutrient.unit }}
        </span>
      </div>
    </template>
  </UCard>
</template>
