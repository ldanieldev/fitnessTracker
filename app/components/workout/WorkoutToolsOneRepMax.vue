<script setup lang="ts">
import { format } from 'date-fns'
import type { OneRepMaxResult } from '~~/shared/types/workout'
import { effectiveOneRepMax, repMaxTable } from '~~/shared/utils/oneRepMax'

const props = defineProps<{ result: OneRepMaxResult | null, pending: boolean, failed: boolean, hasExercise: boolean }>()
const override = defineModel<{ weight: number | null, reps: number | null }>('override', { required: true })
const emit = defineEmits<{ retry: [] }>()

const overridden = computed(() => effectiveOneRepMax(null, override.value) !== null)
const oneRm = computed(() => effectiveOneRepMax(props.result, override.value))
const table = computed(() => (oneRm.value === null ? [] : repMaxTable(oneRm.value)))
const sourceLine = computed(() => {
  if (overridden.value) return 'from your numbers · Brzycki'
  const source = props.result?.source
  if (!source) return ''
  const when = format(new Date(`${source.performedOn}T00:00:00`), 'MMM d')
  return `from ${source.weight}×${source.reps} on ${when} · Brzycki`
})

function setWeight(weight: number | null) {
  override.value = { ...override.value, weight }
}

function setReps(reps: number | null) {
  override.value = { ...override.value, reps }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="pending && !overridden" class="flex flex-col gap-2" data-test="one-rep-max-skeleton" aria-busy="true">
      <USkeleton class="h-9 w-40 rounded-lg" />
      <USkeleton class="h-4 w-56 rounded" />
      <USkeleton v-for="row in 5" :key="row" class="h-6 w-full rounded" />
    </div>
    <div v-else-if="failed && !overridden" class="flex items-center gap-2" data-test="one-rep-max-error">
      <span class="min-w-0 flex-1 text-sm text-error">Couldn't load your history</span>
      <UButton label="Retry" variant="soft" color="error" class="min-h-10" data-test="one-rep-max-retry" @click="emit('retry')" />
    </div>
    <p v-else-if="result?.assisted && !overridden" class="text-sm text-dimmed" data-test="one-rep-max-assisted">
      Not available for assisted exercises.
    </p>
    <template v-else-if="oneRm !== null">
      <p class="text-3xl font-bold tabular-nums" data-test="one-rep-max-estimate">≈ {{ oneRm }} lb</p>
      <p class="text-xs text-dimmed" data-test="one-rep-max-source">{{ sourceLine }}</p>
    </template>
    <p v-else-if="hasExercise" class="text-sm text-dimmed" data-test="one-rep-max-empty">
      No sets of 1–10 reps in the last 90 days.
    </p>
    <p v-else class="text-sm text-dimmed" data-test="one-rep-max-empty">Enter a set to estimate your 1RM.</p>

    <div class="flex items-end gap-2">
      <div class="min-w-0 flex-1">
        <span class="text-sm font-medium text-dimmed">Weight</span>
        <AppNumberInput :model-value="override.weight" placeholder="lb" data-test="override-weight" @update:model-value="setWeight" />
      </div>
      <span class="pb-2 text-dimmed">×</span>
      <div class="w-24 shrink-0">
        <span class="text-sm font-medium text-dimmed">Reps</span>
        <AppNumberInput :model-value="override.reps" placeholder="1–10" data-test="override-reps" @update:model-value="setReps" />
      </div>
    </div>

    <dl v-if="table.length" class="grid grid-cols-3 gap-x-4 gap-y-1 text-sm tabular-nums">
      <div v-for="row in table" :key="row.reps" class="flex justify-between" :data-test="`rm-row-${row.reps}`">
        <dt class="text-dimmed">{{ row.reps }}RM</dt>
        <dd>{{ row.weight }}</dd>
      </div>
    </dl>
  </div>
</template>
