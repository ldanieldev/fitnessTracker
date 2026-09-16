import type { BodyRange, MeasurementDirection, MeasurementGoal, MeasurementType, SeriesGranularity, SeriesPoint } from '../types/body'
import { enumerateDates, rollingAverage, shiftDate } from './nutritionSummary'

export const RANGE_DAYS: Record<Exclude<BodyRange, 'all' | 'mtd'>, number> = { '1m': 30, '3m': 90, '6m': 182, '1y': 365 }

export function rangeStart(range: BodyRange, to: string): string | null {
  if (range === 'all') return null
  if (range === 'mtd') return `${to.slice(0, 7)}-01`
  return shiftDate(to, -RANGE_DAYS[range])
}

export function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000)
}

export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from)
}

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

export const DAILY_CAP_DAYS = 400

export function weekBucket(date: string, weekStart: 0 | 1): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
  return shiftDate(date, -((dow - weekStart + 7) % 7))
}

export function bucketWeekly(points: SeriesPoint[], weekStart: 0 | 1): SeriesPoint[] {
  const byBucket = new Map<string, number>()
  for (const p of points) byBucket.set(weekBucket(p.date, weekStart), p.value)
  return [...byBucket].map(([date, value]) => ({ date, value }))
}

export function buildTrend(points: SeriesPoint[], granularity: SeriesGranularity, from: string, to: string): SeriesPoint[] {
  if (granularity === 'week') {
    const avg = rollingAverage(points.map((p) => p.value), 4)
    return points.flatMap((p, i) => (avg[i] === null ? [] : [{ date: p.date, value: avg[i]! }]))
  }
  if (from > to) return []
  const byDate = new Map(points.map((p) => [p.date, p.value]))
  const dates = enumerateDates(from, to)
  const avg = rollingAverage(dates.map((d) => byDate.get(d) ?? null), 7)
  return dates.flatMap((d, i) => (avg[i] === null ? [] : [{ date: d, value: avg[i]! }]))
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

export function goalProgress(goal: Pick<MeasurementGoal, 'targetValue' | 'startValue'>, latest: number | null): GoalProgress {
  if (latest === null) return { remaining: null, percent: null, reached: false }
  const span = goal.targetValue - goal.startValue
  const remaining = goal.targetValue - latest
  const reached = span === 0 ? latest === goal.targetValue : span > 0 ? latest >= goal.targetValue : latest <= goal.targetValue
  const percent = span === 0 ? (reached ? 1 : 0) : Math.min(1, Math.max(0, (latest - goal.startValue) / span))
  return { remaining, percent, reached }
}

export function requiredPace(goal: Pick<MeasurementGoal, 'targetValue' | 'targetDate'>, latest: number | null, today: string): number | null {
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
