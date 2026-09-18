import type { SetMeasures } from '../types/workout'
import { FIELD, type SetMeasure } from './setRules'

const UNIT: Record<SetMeasure, string> = {
  weight: ' lb',
  reps: '',
  distance: ' m',
  duration: ' s'
}

// Not `formatValue`: shared/utils is auto-imported flat, and that name is already bodyMetrics'.
function formatMeasure(measure: SetMeasure, source: SetMeasures): string {
  const value = source[FIELD[measure]]
  return value === null || value === undefined ? '' : `${value}${UNIT[measure]}`
}

export function formatSet(measures: SetMeasure[], source: SetMeasures): string {
  return measures.map((measure) => formatMeasure(measure, source)).join(' × ')
}
