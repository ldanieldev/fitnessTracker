import type { SetMeasures } from '../types/workout'
import { clockLabel, milesLabel } from './cardioUnits'
import { FIELD, type SetMeasure } from './setRules'

const UNIT: Record<'weight' | 'reps', string> = {
  weight: ' lb',
  reps: ''
}

export function measureText(measure: SetMeasure, value: number): string {
  if (measure === 'distance') return milesLabel(value)
  if (measure === 'duration') return clockLabel(value)
  return `${value}${UNIT[measure]}`
}

// Not `formatValue`: shared/utils is auto-imported flat, and that name is already bodyMetrics'.
function formatMeasure(measure: SetMeasure, source: SetMeasures): string {
  const value = source[FIELD[measure]]
  return value === null || value === undefined ? '' : measureText(measure, value)
}

export function formatSet(measures: SetMeasure[], source: SetMeasures): string {
  return measures.map((measure) => formatMeasure(measure, source)).join(' × ')
}
