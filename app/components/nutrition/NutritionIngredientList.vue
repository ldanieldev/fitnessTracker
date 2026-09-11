<script setup lang="ts">
import { type EditorLine, isLineBroken, lineNutrients } from '~/utils/nutrition/lines'

const props = defineProps<{ lines: EditorLine[], idToKey: Map<number, string> }>()
defineEmits<{ edit: [uid: string] }>()

const rows = computed(() =>
  props.lines.map((line) => ({ line, broken: isLineBroken(line), energy: lineNutrients(line, props.idToKey)?.energy }))
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <button
      v-for="row in rows"
      :key="row.line.uid"
      type="button"
      class="flex items-center gap-3 p-3 rounded-lg text-left text-sm min-h-12"
      :class="row.broken ? 'bg-error/10 ring ring-error/40' : 'bg-elevated/50'"
      data-test="ingredient-row"
      @click="$emit('edit', row.line.uid)"
    >
      <div class="flex flex-col min-w-0 flex-1">
        <span class="font-medium truncate">{{ row.line.name }}</span>
        <span class="text-dimmed text-xs">{{ row.line.quantity }} {{ row.line.unitLabel }}</span>
      </div>
      <UBadge v-if="row.broken" color="error" variant="subtle" label="Unavailable" data-test="ingredient-broken" />
      <span v-else class="text-dimmed">{{ row.energy?.toFixed(0) ?? '—' }} kcal</span>
      <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 shrink-0" />
    </button>
    <p v-if="lines.length === 0" class="text-sm text-dimmed">No ingredients yet</p>
  </div>
</template>
