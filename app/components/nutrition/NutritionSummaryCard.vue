<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { DiaryTargetRow } from '~/composables/useDiaryDay'
import { evaluateTarget, type TargetState } from '~~/shared/utils/nutritionTargets'
import { formatAmount, MACRO_CLASS, type MacroKey } from '~/utils/nutrition/macros'

const props = withDefaults(defineProps<{
  targets: DiaryTargetRow[]
  totals: Record<string, number>
  goalName: string | null
  interactive?: boolean
}>(), { interactive: true })

const mode = defineModel<'remaining' | 'consumed'>('mode', { default: 'remaining' })
const emit = defineEmits<{ 'apply-goal': [] }>()

interface SummaryRow {
  key: string
  name: string
  unit: string
  state: TargetState | 'none'
  consumed: number
  remaining: number | null
  amount: number | null
  progress: number | null
}

const BAR_KEYS = new Set(['protein', 'carbohydrate', 'fat'])
const BAR_COLOR: Record<string, 'protein' | 'carb' | 'fat'> = { protein: 'protein', carbohydrate: 'carb', fat: 'fat' }
const CHIP_COLOR: Record<SummaryRow['state'], 'error' | 'success' | 'neutral'> = { over: 'error', met: 'success', under: 'neutral', none: 'neutral' }

const rows = computed<SummaryRow[]>(() =>
  props.targets.map((target) => {
    const consumed = props.totals[target.key] ?? 0

    if (target.amount === null || target.direction === null) {
      return { key: target.key, name: target.name, unit: target.unit, state: 'none', consumed, remaining: null, amount: null, progress: null }
    }

    const evaluation = evaluateTarget({ consumed, target: target.amount, direction: target.direction })
    return { key: target.key, name: target.name, unit: target.unit, state: evaluation.state, consumed, remaining: evaluation.remaining, amount: target.amount, progress: evaluation.progress }
  })
)

const energyRow = computed(() => rows.value.find((row) => row.key === 'energy') ?? null)
const barRows = computed(() => rows.value.filter((row) => BAR_KEYS.has(row.key)))
const chipRows = computed(() => rows.value.filter((row) => row.key !== 'energy' && !BAR_KEYS.has(row.key)))

// The ring's fill always tracks consumed/target progress; only the displayed number toggles with `mode`.
const energyDisplay = computed(() => {
  const row = energyRow.value
  if (!row) return 0
  return mode.value === 'consumed' ? row.consumed : (row.remaining ?? row.consumed)
})
const energyLabel = computed(() => {
  const row = energyRow.value
  if (row && mode.value === 'remaining' && row.state === 'over') return `over by ${formatAmount('energy', Math.abs(row.remaining ?? 0))}`
  return formatAmount('energy', row ? energyDisplay.value : null)
})
const energySub = computed(() => (mode.value === 'consumed' || energyRow.value?.amount === null ? 'kcal eaten' : 'kcal left'))
const energyColor = computed(() => (energyRow.value?.state === 'over' ? 'error' : 'primary'))
const energyTotalText = computed(() => {
  const row = energyRow.value
  if (!row) return '—'
  const consumedText = Math.round(row.consumed).toLocaleString()
  return row.amount === null ? consumedText : `${consumedText} / ${Math.round(row.amount).toLocaleString()}`
})

function barValue(row: SummaryRow): string {
  if (row.amount === null) return formatAmount(row.key, row.consumed)
  return formatAmount(row.key, mode.value === 'consumed' ? row.consumed : row.remaining)
}

function barFigure(row: SummaryRow): string {
  if (row.amount === null || mode.value === 'consumed') return `${formatAmount(row.key, row.consumed)} ${row.unit}`
  return `${formatAmount(row.key, row.remaining)} ${row.unit} left`
}

function chipFigure(row: SummaryRow): string {
  if (row.amount === null) return `${row.name} ${formatAmount(row.key, row.consumed)} ${row.unit}`
  return `${row.name} ${formatAmount(row.key, row.consumed)} / ${formatAmount(row.key, row.amount)} ${row.unit}`
}

function totalFigure(row: SummaryRow): string {
  return `${formatAmount(row.key, row.consumed)} ${row.unit}`
}

const menuTrigger = computed(() => `${props.goalName ?? 'No goal'} · ${mode.value === 'remaining' ? 'Remaining' : 'Consumed'}`)

const menu = computed<DropdownMenuItem[][]>(() => [
  [
    { label: 'Remaining', type: 'checkbox', checked: mode.value === 'remaining', onUpdateChecked: () => (mode.value = 'remaining') },
    { label: 'Consumed', type: 'checkbox', checked: mode.value === 'consumed', onUpdateChecked: () => (mode.value = 'consumed') }
  ],
  [{ label: 'Apply goal profile…', icon: 'i-lucide-target', onSelect: () => emit('apply-goal') }]
])
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center gap-4">
      <div class="flex flex-col items-center gap-1">
        <NutritionMacroRing :value="energyRow?.consumed ?? 0" :max="energyRow?.amount ?? null" :label="energyLabel" :sub="energySub" :size="100" :color="energyColor" />
        <span class="text-xs text-dimmed" data-test="total-energy">{{ energyTotalText }}</span>
        <span data-test="energy-value" class="sr-only">{{ energyLabel }}</span>
        <span data-test="energy-state" class="sr-only">{{ energyRow?.state ?? 'none' }}</span>
      </div>

      <div class="flex min-w-40 flex-1 flex-col gap-3">
        <div v-for="row in barRows" :key="row.key" class="flex flex-col gap-0.5">
          <NutritionMacroBar
            :label="row.name"
            :label-class="MACRO_CLASS[row.key as MacroKey]"
            :figure="barFigure(row)"
            :progress="row.progress === null ? null : row.progress * 100"
            :color="row.state === 'over' ? 'error' : BAR_COLOR[row.key]"
            :data-test="`bar-${row.key}`"
          />
          <span :data-test="`${row.key}-value`" class="sr-only">{{ barValue(row) }}</span>
          <span :data-test="`${row.key}-state`" class="sr-only">{{ row.state }}</span>
          <span :data-test="`total-${row.key}`" class="sr-only">{{ totalFigure(row) }}</span>
        </div>
      </div>
    </div>

    <div v-if="chipRows.length" class="mt-3 flex flex-wrap gap-2">
      <UBadge v-for="row in chipRows" :key="row.key" variant="subtle" :color="CHIP_COLOR[row.state]">
        {{ chipFigure(row) }}
        <span :data-test="`${row.key}-value`" class="sr-only">{{ formatAmount(row.key, row.consumed) }}</span>
        <span :data-test="`${row.key}-state`" class="sr-only">{{ row.state }}</span>
        <span :data-test="`total-${row.key}`" class="sr-only">{{ totalFigure(row) }}</span>
      </UBadge>
    </div>

    <template v-if="interactive" #footer>
      <UDropdownMenu :items="menu">
        <UButton :label="menuTrigger" trailing-icon="i-lucide-chevron-down" color="neutral" variant="soft" size="sm" data-test="summary-goal-menu" />
      </UDropdownMenu>
    </template>
  </UCard>
</template>
