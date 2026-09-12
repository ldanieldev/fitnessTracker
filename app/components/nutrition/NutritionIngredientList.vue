<script setup lang="ts">
import { type EditorLine, isLineBroken, lineNutrients } from '~/utils/nutrition/lines'

const props = defineProps<{ lines: EditorLine[], idToKey: Map<number, string> }>()
defineEmits<{ edit: [uid: string] }>()

const rows = computed(() =>
  props.lines.map((line) => ({ line, broken: isLineBroken(line), nutrients: lineNutrients(line, props.idToKey) }))
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <NutritionResultRow
      v-for="row in rows"
      :key="row.line.uid"
      data-test="ingredient-row"
      :title="row.line.name"
      :amount-text="`${row.line.quantity} ${row.line.unitLabel}`"
      :nutrients="row.broken ? null : row.nutrients"
      :energy="row.broken ? null : (row.nutrients?.energy ?? null)"
      :root-class="row.broken ? 'bg-error/10 ring ring-error/40' : ''"
      chevron
      @open="$emit('edit', row.line.uid)"
    >
      <template v-if="row.broken" #actions>
        <UBadge color="error" variant="subtle" label="Unavailable" data-test="ingredient-broken" />
      </template>
    </NutritionResultRow>
    <p v-if="lines.length === 0" class="text-sm text-dimmed">No ingredients yet</p>
  </div>
</template>
