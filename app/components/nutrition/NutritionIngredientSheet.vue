<script setup lang="ts">
import type { EditorLine } from '~/utils/nutrition/lines'

const props = defineProps<{ line: EditorLine | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ update: [line: EditorLine], remove: [uid: string], replace: [uid: string] }>()

const draft = ref({ quantity: 1, unitLabel: '' })
watch(() => props.line, (line) => {
  if (line) draft.value = { quantity: line.quantity, unitLabel: line.unitLabel }
}, { immediate: true })

function done() {
  if (!props.line) return
  emit('update', { ...props.line, ...draft.value })
  open.value = false
}

function remove() {
  if (!props.line) return
  emit('remove', props.line.uid)
  open.value = false
}

function replace() {
  if (!props.line) return
  emit('replace', props.line.uid)
  open.value = false
}
</script>

<template>
  <AppSheet v-model:open="open" :title="line?.name ?? 'Ingredient'">
    <template #body>
      <div class="flex flex-col gap-3">
        <NutritionAmountInput v-if="line?.food" v-model="draft" :food="line.food" />
        <p v-else class="text-sm text-dimmed">This food is no longer available. Remove it or replace it with another food.</p>
        <div class="flex w-full gap-2">
          <UButton label="Remove" color="error" variant="soft" data-test="ingredient-remove" @click="remove" />
          <UButton label="Replace" color="neutral" variant="soft" data-test="ingredient-replace" @click="replace" />
          <UButton v-if="line?.food" label="Done" class="ml-auto" :disabled="!(draft.quantity > 0)" data-test="ingredient-done" @click="done" />
        </div>
      </div>
    </template>
  </AppSheet>
</template>
