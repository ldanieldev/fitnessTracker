import type { SeriesPoint } from '../types/series'
import type { GraphMetric, LoadStyle, TrackingType } from '../types/workout'
import { enumerateDates } from './nutritionSummary'
import { brzycki, roundTenth } from './oneRepMax'
import { measuresFor } from './setRules'

const TREND_WINDOW_DAYS = 28

export interface RollupSet {
  weight: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
}

export interface RollupValues {
  setCount: number
  totalReps: number
  totalVolume: number | null
  topWeight: number | null
  topWeightReps: number | null
  topSetVolume: number | null
  bestE1rm: number | null
  weightByReps: Record<string, number>
  totalDistanceMeters: number | null
  totalDurationSeconds: number | null
  bestPace: number | null
}

function sumOf(values: (number | null)[]): number | null {
  const defined = values.filter((v): v is number => v != null)
  return defined.length ? defined.reduce((a, b) => a + b, 0) : null
}

function maxOf(values: number[]): number | null {
  return values.length ? Math.max(...values) : null
}

export function rollupFrom(sets: RollupSet[], loadStyle: LoadStyle | null, repCap: number): RollupValues {
  const assisted = loadStyle === 'assisted'
  const better = (a: number, b: number) => (assisted ? Math.min(a, b) : Math.max(a, b))
  const weighted = sets.filter((s) => s.weight != null)
  const volumes = assisted ? [] : sets.filter((s) => s.weight != null && s.reps != null).map((s) => s.weight! * s.reps!)
  const topWeight = weighted.length ? weighted.map((s) => s.weight!).reduce(better) : null
  const topWeightReps =
    topWeight == null
      ? null
      : maxOf(weighted.filter((s) => s.weight === topWeight && s.reps != null).map((s) => s.reps!))
  const weightByReps: Record<string, number> = {}
  for (const s of sets) {
    if (s.weight == null || s.reps == null || s.reps <= 0) continue
    const key = String(s.reps)
    const current = weightByReps[key]
    weightByReps[key] = current === undefined ? s.weight : better(current, s.weight)
  }
  const estimates = assisted
    ? []
    : sets
        .filter((s) => s.weight != null && s.weight > 0 && s.reps != null && s.reps >= 1 && s.reps <= repCap)
        .map((s) => brzycki(s.weight!, s.reps!))
  const paces = sets
    .filter(
      (s) => s.distanceMeters != null && s.distanceMeters > 0 && s.durationSeconds != null && s.durationSeconds > 0
    )
    .map((s) => s.distanceMeters! / s.durationSeconds!)

  return {
    setCount: sets.length,
    totalReps: sumOf(sets.map((s) => s.reps)) ?? 0,
    totalVolume: volumes.length ? volumes.reduce((a, b) => a + b, 0) : null,
    topWeight,
    topWeightReps,
    topSetVolume: maxOf(volumes),
    bestE1rm: estimates.length ? roundTenth(Math.max(...estimates)) : null,
    weightByReps,
    totalDistanceMeters: sumOf(sets.map((s) => s.distanceMeters)),
    totalDurationSeconds: sumOf(sets.map((s) => s.durationSeconds)),
    bestPace: maxOf(paces)
  }
}

export function metricsFor(trackingType: TrackingType, loadStyle: LoadStyle | null): GraphMetric[] {
  const measures = measuresFor(trackingType)
  const metrics: GraphMetric[] = []
  const weightAndReps = measures.includes('weight') && measures.includes('reps')
  if (weightAndReps && loadStyle !== 'assisted') metrics.push('e1rm')
  if (measures.includes('weight')) metrics.push('max_weight')
  if (weightAndReps && loadStyle !== 'assisted') metrics.push('volume')
  if (measures.includes('reps')) metrics.push('total_reps')
  if (weightAndReps) metrics.push('weight_at_reps')
  if (measures.includes('distance')) metrics.push('distance')
  if (measures.includes('duration')) metrics.push('duration')
  if (measures.includes('distance') && measures.includes('duration')) metrics.push('pace')
  return metrics
}

export function metricLabel(metric: GraphMetric, loadStyle: LoadStyle | null): string {
  if (metric === 'max_weight') return loadStyle === 'assisted' ? 'Lowest assist' : 'Max weight'
  const labels: Record<Exclude<GraphMetric, 'max_weight'>, string> = {
    e1rm: 'Estimated 1RM',
    volume: 'Volume',
    total_reps: 'Total reps',
    weight_at_reps: 'Weight at reps',
    distance: 'Distance',
    duration: 'Duration',
    pace: 'Pace'
  }
  return labels[metric]
}

export function metricUnit(metric: GraphMetric): string {
  const units: Record<GraphMetric, string> = {
    e1rm: 'lb',
    max_weight: 'lb',
    volume: 'lb',
    total_reps: 'reps',
    weight_at_reps: 'lb',
    distance: 'm',
    duration: 's',
    pace: 'm/s'
  }
  return units[metric]
}

export function metricPrecision(metric: GraphMetric): number {
  if (metric === 'pace') return 2
  if (metric === 'e1rm' || metric === 'max_weight' || metric === 'weight_at_reps') return 1
  return 0
}

export function metricValue(row: RollupValues, metric: GraphMetric, reps: number | null): number | null {
  switch (metric) {
    case 'e1rm':
      return row.bestE1rm
    case 'max_weight':
      return row.topWeight
    case 'volume':
      return row.totalVolume
    case 'total_reps':
      return row.totalReps
    case 'weight_at_reps':
      return reps == null ? null : (row.weightByReps[String(reps)] ?? null)
    case 'distance':
      return row.totalDistanceMeters
    case 'duration':
      return row.totalDurationSeconds
    case 'pace':
      return row.bestPace
  }
}

export function metricLowerIsBetter(metric: GraphMetric, loadStyle: LoadStyle | null): boolean {
  return (metric === 'max_weight' || metric === 'weight_at_reps') && loadStyle === 'assisted'
}

// 28 days approximates a training block for sparse sessions; rollingAverage blanks short ranges, so skip it here.
export function workoutTrend(points: SeriesPoint[], from: string, to: string): SeriesPoint[] {
  if (points.length === 0 || from > to) return []
  const sums = new Map<string, { total: number; count: number }>()
  for (const point of points) {
    const entry = sums.get(point.date)
    if (entry) {
      entry.total += point.value
      entry.count += 1
    } else {
      sums.set(point.date, { total: point.value, count: 1 })
    }
  }
  const byDate = new Map([...sums].map(([date, { total, count }]) => [date, total / count]))
  const dates = enumerateDates(from, to)
  const values = dates.map((d) => byDate.get(d) ?? null)
  return dates.flatMap((date, i) => {
    const window = values.slice(Math.max(0, i + 1 - TREND_WINDOW_DAYS), i + 1).filter((v): v is number => v != null)
    if (window.length === 0) return []
    return [{ date, value: window.reduce((a, b) => a + b, 0) / window.length }]
  })
}

export function latestLoadStyle(
  rows: Array<{ performedOn: string; sessionId: number; loadStyle: LoadStyle | null }>
): LoadStyle | null {
  let latest: (typeof rows)[number] | null = null
  for (const row of rows) {
    const newer =
      !latest ||
      row.performedOn > latest.performedOn ||
      (row.performedOn === latest.performedOn && row.sessionId > latest.sessionId)
    if (newer) latest = row
  }
  return latest?.loadStyle ?? null
}
