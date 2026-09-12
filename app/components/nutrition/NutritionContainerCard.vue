<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { NUTRITION_MACROS } from '~/constants/nutrition'
import { macroParts } from '~/utils/nutrition/macros'
import type { DiaryContainer } from '~/composables/useDiaryDay'

interface SubtotalNutrient {
  key: string
  name: string
  unit: string
}

const PCF_KEYS = ['energy', 'protein', 'carbohydrate', 'fat']

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

const trackedNutrients = computed(() => (props.nutrients?.length ? props.nutrients : NUTRITION_MACROS))
const trackedKeys = computed(() => new Set(trackedNutrients.value.map((n) => n.key)))
const extras = computed(() => trackedNutrients.value.filter((n) => !PCF_KEYS.includes(n.key)))
const withEnergy = computed(() => trackedKeys.value.has('energy'))

const subtotalNutrients = computed(() => {
  if (props.container.entries.length > 0) return props.container.subtotals
  // An empty meal has no subtotals object at all — seed zeros so the footer reads 0, not "—".
  return Object.fromEntries(trackedNutrients.value.map((n) => [n.key, 0]))
})

const subtotals = computed(() =>
  macroParts(subtotalNutrients.value, { withEnergy: withEnergy.value, extras: extras.value })
    .filter((part) => trackedKeys.value.has(part.key))
)

const energy = computed(() => props.container.subtotals.energy ?? 0)
</script>

<template>
  <UCard :data-test="`container-${container.id}`">
    <template #header>
      <div class="flex items-center justify-between gap-2" data-test="container-header">
        <div class="flex min-w-0 items-baseline gap-2">
          <span class="truncate font-semibold text-highlighted">{{ container.name }}</span>
          <span class="shrink-0 text-xs tabular-nums text-dimmed">{{ Math.round(energy) }} kcal</span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UDropdownMenu :items="menu">
            <UButton icon="i-lucide-ellipsis-vertical" variant="ghost" color="neutral" size="sm" aria-label="Meal actions" data-test="container-menu" />
          </UDropdownMenu>
          <UButton icon="i-lucide-plus" color="primary" size="sm" :to="addHref" aria-label="Add to this meal" data-test="container-add" />
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
      <div class="grid gap-1 text-center text-[11px]" :style="{ gridTemplateColumns: `repeat(${subtotals.length}, minmax(0, 1fr))` }">
        <div v-for="cell in subtotals" :key="cell.key" data-test="subtotal-cell">
          <div class="font-semibold tabular-nums text-highlighted" :class="cell.cls" :data-test="`subtotal-${cell.key}`">{{ cell.text }}</div>
          <div class="text-dimmed">{{ cell.label }}</div>
        </div>
      </div>
    </template>
  </UCard>
</template>
