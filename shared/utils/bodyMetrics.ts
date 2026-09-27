import type { MeasurementDirection, MeasurementGoal, MeasurementType } from '../types/body'
import type { SeriesPoint } from '../types/series'
import { dayIndex, daysBetween } from './series'

export function formatValue(value: number | null | undefined, precision: number): string {
  return value === null || value === undefined ? '—' : value.toFixed(precision)
}

export function formatDelta(delta: number | null, precision: number): string {
  if (delta === null) return '—'
  const text = Math.abs(delta).toFixed(precision)
  if (Number(text) === 0) return text
  return delta > 0 ? `+${text}` : `-${text}`
}

export type DeltaTone = 'success' | 'error' | 'neutral'

export function deltaTone(delta: number | null, direction: MeasurementDirection): DeltaTone {
  if (delta === null || delta === 0 || direction === 'neutral') return 'neutral'
  const improved = direction === 'lower' ? delta < 0 : delta > 0
  return improved ? 'success' : 'error'
}

export function effectiveDirection(
  type: Pick<MeasurementType, 'direction'>,
  goal: Pick<MeasurementGoal, 'targetValue' | 'startValue'> | null
): MeasurementDirection {
  if (!goal || goal.targetValue === goal.startValue) return type.direction
  return goal.targetValue < goal.startValue ? 'lower' : 'higher'
}

export interface GoalProgress {
  remaining: number | null
  percent: number | null
  reached: boolean
}

export function goalProgress(
  goal: Pick<MeasurementGoal, 'targetValue' | 'startValue'>,
  latest: number | null
): GoalProgress {
  if (latest === null) return { remaining: null, percent: null, reached: false }
  const span = goal.targetValue - goal.startValue
  const remaining = goal.targetValue - latest
  const reached = span === 0
    ? latest === goal.targetValue
    : span > 0 ? latest >= goal.targetValue : latest <= goal.targetValue
  const percent = span === 0 ? (reached ? 1 : 0) : Math.min(1, Math.max(0, (latest - goal.startValue) / span))
  return { remaining, percent, reached }
}

export function requiredPace(
  goal: Pick<MeasurementGoal, 'targetValue' | 'targetDate'>,
  latest: number | null,
  today: string
): number | null {
  if (latest === null || !goal.targetDate) return null
  const days = daysBetween(today, goal.targetDate)
  if (days <= 0) return null
  return ((goal.targetValue - latest) / days) * 7
}

export function actualPace(trend: SeriesPoint[], windowDays = 28): number | null {
  const last = trend[trend.length - 1]
  if (!last) return null
  const cutoff = dayIndex(last.date) - windowDays
  const pts = trend.filter((p) => dayIndex(p.date) >= cutoff)
  if (pts.length < 2) return null
  const xs = pts.map((p) => dayIndex(p.date))
  const ys = pts.map((p) => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  let num = 0
  let den = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my)
    den += (xs[i]! - mx) ** 2
  }
  return den === 0 ? null : (num / den) * 7
}

export function onTrack(required: number | null, actual: number | null): boolean | null {
  if (required === null || actual === null) return null
  if (required === 0) return true
  return Math.sign(actual) === Math.sign(required) && Math.abs(actual) >= Math.abs(required)
}
