<script lang="ts">
import type { LoadStyle, WorkoutEntry } from '~~/shared/types/workout'
import { DEFAULT_BAR_WEIGHT } from '~~/shared/utils/plates'
import { effectiveOneRepMax } from '~~/shared/utils/oneRepMax'
import WorkoutToolsPlates from '~/components/workout/WorkoutToolsPlates.vue'
import WorkoutToolsOneRepMax from '~/components/workout/WorkoutToolsOneRepMax.vue'
import WorkoutToolsSetCalc from '~/components/workout/WorkoutToolsSetCalc.vue'

export type ToolsTab = 'plates' | 'one-rep-max' | 'set-calc'

export interface ToolContext {
  exerciseId: number | null
  loadStyle: LoadStyle | null
  bar: number | null
  sizes: number[] | null
  increment: number
}
</script>

<script setup lang="ts">
const props = defineProps<{ entries: WorkoutEntry[] }>()
const emit = defineEmits<{ useWeight: [entryId: number, weight: number] }>()
const open = defineModel<boolean>('open', { default: false })
const entryId = defineModel<number | null>('entryId', { default: null })
const tab = defineModel<ToolsTab>('tab', { default: 'plates' })
const target = defineModel<number | null>('target', { default: null })

const { plateSizes, oneRepMaxRepCap } = useWorkoutPrefs()
const freeBar = ref<number | null>(DEFAULT_BAR_WEIGHT)
const DEFAULT_INCREMENT = 5

const tabItems = [
  { label: 'Plates', value: 'plates', test: 'tools-tab-plates' },
  { label: '1RM', value: 'one-rep-max', test: 'tools-tab-one-rep-max' },
  { label: 'Set calc', value: 'set-calc', test: 'tools-tab-set-calc' }
]

const exerciseOptions = computed(() => [
  { label: 'No exercise', value: 'none' },
  ...props.entries.map((entry) => ({ label: entry.exerciseName, value: String(entry.id) }))
])
const exerciseModel = computed({
  get: () => (entryId.value === null ? 'none' : String(entryId.value)),
  set: (value: string) => { entryId.value = value === 'none' ? null : Number(value) }
})

const selected = computed(() => props.entries.find((entry) => entry.id === entryId.value) ?? null)
const context = computed<ToolContext>(() => {
  const entry = selected.value
  if (!entry) {
    return {
      exerciseId: null,
      loadStyle: 'barbell',
      bar: freeBar.value,
      sizes: plateSizes.value,
      increment: DEFAULT_INCREMENT
    }
  }
  const barbell = entry.loadStyle === 'barbell'
  return {
    exerciseId: entry.exerciseId,
    loadStyle: entry.loadStyle,
    bar: barbell ? (entry.barWeight ?? DEFAULT_BAR_WEIGHT) : null,
    sizes: barbell ? entry.plateSizes : null,
    increment: entry.weightIncrement ?? DEFAULT_INCREMENT
  }
})

const exerciseId = computed(() => selected.value?.exerciseId ?? null)
const oneRepMax = useOneRepMax(exerciseId)
const override = ref<{ weight: number | null, reps: number | null }>({ weight: null, reps: null })
const oneRm = computed(() => effectiveOneRepMax(oneRepMax.result.value, override.value, oneRepMaxRepCap.value))

// Refetched on every visit because the newest logged set may have raised the estimate.
watch([open, tab, exerciseId], ([isOpen, current]) => {
  if (isOpen && current !== 'plates') oneRepMax.load()
}, { immediate: true })

watch(exerciseId, () => {
  override.value = { weight: null, reps: null }
})

function useWeight(weight: number) {
  target.value = weight
  tab.value = 'plates'
}
</script>

<template>
  <AppSheet v-model:open="open" title="Tools">
    <template #body>
      <div class="flex flex-col gap-4" data-test="tools-sheet">
        <USelect v-model="exerciseModel" :items="exerciseOptions" class="w-full" data-test="tools-exercise" />
        <UTabs v-model="tab" :items="tabItems" :content="false" :ui="{ trigger: 'min-h-10' }" class="w-full">
          <template #default="{ item }">
            <span :data-test="item.test">{{ item.label }}</span>
          </template>
        </UTabs>
        <WorkoutToolsPlates
          v-if="tab === 'plates'"
          v-model:target="target"
          :bar="context.bar"
          :sizes="context.sizes"
          :bar-editable="selected === null"
          :can-use="selected !== null"
          @update:bar="(value) => freeBar = value"
          @use="(weight) => selected && emit('useWeight', selected.id, weight)"
        />
        <WorkoutToolsOneRepMax
          v-else-if="tab === 'one-rep-max'"
          v-model:override="override"
          :result="oneRepMax.result.value"
          :pending="oneRepMax.pending.value"
          :failed="oneRepMax.failed.value"
          :has-exercise="selected !== null"
          @retry="oneRepMax.load()"
        />
        <WorkoutToolsSetCalc
          v-else
          :one-rm="oneRm"
          :pending="oneRepMax.pending.value"
          :context="context"
          @use="useWeight"
        />
      </div>
    </template>
  </AppSheet>
</template>
