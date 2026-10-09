import type { EntryTarget, SetMeasures, TargetMetric, TrackingType } from '../types/workout'
import { measuresFor } from './setRules'
import { clockLabel, metersToMiles } from './cardioUnits'

const METRIC_FIELD: Record<TargetMetric, keyof SetMeasures> = {
  reps: 'reps',
  time: 'durationSeconds',
  distance: 'distanceMeters'
}

export function targetMetricFor(trackingType: TrackingType): TargetMetric | null {
  const measures = measuresFor(trackingType)
  if (measures.includes('reps')) return 'reps'
  if (measures.includes('duration')) return 'time'
  if (measures.includes('distance')) return 'distance'
  return null
}

export function targetValueOf(metric: TargetMetric, set: SetMeasures): number | null {
  return set[METRIC_FIELD[metric]] ?? null
}

export function copyTargetsFrom(
  trackingType: TrackingType,
  sets: SetMeasures[],
  source: EntryTarget | null,
  sourceTrackingType: TrackingType = trackingType
): EntryTarget | null {
  const metric = targetMetricFor(trackingType)
  const sameMetric = metric === targetMetricFor(sourceTrackingType)
  let low = sameMetric ? source?.low ?? null : null
  let high = sameMetric ? source?.high ?? null : null
  if (low === null && high === null && metric) {
    const values = sets.map((set) => targetValueOf(metric, set)).filter((value): value is number => value !== null)
    if (values.length) {
      low = Math.min(...values)
      high = Math.max(...values)
    }
  }
  const count = sets.length || null
  if (count === null && low === null && high === null) return null
  return { sets: count, low, high, weight: null }
}

function span(low: number | null, high: number | null): [number, number] | [number] | [] {
  if (low === null && high === null) return []
  if (low === null || high === null || low === high) return [(low ?? high)!]
  return [low, high]
}

function rangeValue(metric: TargetMetric, value: number): string {
  if (metric === 'distance') return String(metersToMiles(value))
  if (metric === 'time') return clockLabel(value)
  return String(value)
}

export function rangePlaceholder(low: number | null, high: number | null, metric: TargetMetric = 'reps'): string | null {
  const values = span(low, high)
  return values.length ? values.map((value) => rangeValue(metric, value)).join('–') : null
}

export function formatTargetRange(metric: TargetMetric, low: number | null, high: number | null): string {
  const text = rangePlaceholder(low, high, metric)
  if (text === null) return ''
  return metric === 'distance' ? `${text} mi` : text
}

function rangeFor(trackingType: TrackingType, target: EntryTarget): string {
  const metric = targetMetricFor(trackingType)
  return metric ? formatTargetRange(metric, target.low, target.high) : ''
}

export function targetSummary(trackingType: TrackingType, target: EntryTarget | null): string {
  if (!target) return ''
  const range = rangeFor(trackingType, target)
  let text = target.sets !== null ? (range ? `${target.sets} × ${range}` : `${target.sets} sets`) : range
  if (target.weight !== null) text = `${text} @ ${target.weight} lb`
  return text
}

export function targetProgressLabel(trackingType: TrackingType, target: EntryTarget | null, logged: number): string | null {
  if (!target) return null
  const range = rangeFor(trackingType, target)
  if (target.sets === null) return range || null
  return range ? `${logged} of ${target.sets} · ${range}` : `${logged} of ${target.sets}`
}
