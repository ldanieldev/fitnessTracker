<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { NUTRITION_MACROS } from '~/constants/nutrition'
import type { DiaryContainer } from '~/composables/useDiaryDay'

interface SubtotalNutrient {
  key: string
  name: string
  unit: string
}

const props = defineProps<{
  container: DiaryContainer
  date: string
  nutrients?: SubtotalNutrient[]
  selectable?: boolean
  selectedIds?: Set<number>
}>()

const emit = defineEmits<{
  'copy-container': [id: number]
  'toggle-entry': [id: number]
  'open-entry': [id: number]
  'save-as': [containerId: number, kind: 'recipe' | 'saved-meal']
}>()

const addHref = computed(() => `/diary/${props.date}/add?containerId=${props.container.id}`)

const menu = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Add to this meal', icon: 'i-lucide-plus', to: addHref.value },
  { label: 'Copy meal', icon: 'i-lucide-copy', onSelect: () => emit('copy-container', props.container.id) }
], [
  { label: 'Save as recipe', icon: 'i-lucide-chef-hat', onSelect: () => emit('save-as', props.container.id, 'recipe') },
  { label: 'Save as saved meal', icon: 'i-lucide-bookmark', onSelect: () => emit('save-as', props.container.id, 'saved-meal') }
]])

const subtotals = computed(() => {
  const list: readonly SubtotalNutrient[] = props.nutrients?.length ? props.nutrients : NUTRITION_MACROS
  return list.map((nutrient) => ({ ...nutrient, value: props.container.subtotals[nutrient.key] ?? 0 }))
})

const energy = computed(() => props.container.subtotals.energy ?? 0)
</script>

<template>
  <UCard :data-test="`container-${container.id}`">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <span class="font-medium truncate">{{ container.name }}</span>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-sm text-dimmed">{{ energy.toFixed(0) }} kcal</span>
          <UDropdownMenu :items="menu">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" size="xs" aria-label="Meal actions" data-test="container-menu" />
          </UDropdownMenu>
        </div>
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
        @open="emit('open-entry', entry.id)"
        @toggle-select="emit('toggle-entry', entry.id)"
      />
    </div>

    <template #footer>
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-wrap gap-x-3 text-sm text-dimmed">
          <span v-for="nutrient in subtotals" :key="nutrient.key" :data-test="`subtotal-${nutrient.key}`">
            {{ nutrient.value.toFixed(1) }} {{ nutrient.unit }}
          </span>
        </div>
        <ULink :to="addHref" data-test="container-add">+ Add</ULink>
      </div>
    </template>
  </UCard>
</template>
