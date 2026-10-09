import type { ChartRange, SeriesGranularity, SeriesPoint } from '../types/series'
import { enumerateDates, rollingAverage, shiftDate } from './nutritionSummary'

export const RANGE_DAYS: Record<Exclude<ChartRange, 'all' | 'mtd'>, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 182,
  '1y': 365
}

export function rangeStart(range: ChartRange, to: string): string | null {
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

export function buildTrend(
  points: SeriesPoint[],
  granularity: SeriesGranularity,
  from: string,
  to: string
): SeriesPoint[] {
  if (granularity === 'week') {
    const avg = rollingAverage(
      points.map((p) => p.value),
      4
    )
    return points.flatMap((p, i) => (avg[i] === null ? [] : [{ date: p.date, value: avg[i]! }]))
  }
  if (from > to) return []
  const byDate = new Map(points.map((p) => [p.date, p.value]))
  const dates = enumerateDates(from, to)
  const avg = rollingAverage(
    dates.map((d) => byDate.get(d) ?? null),
    7
  )
  return dates.flatMap((d, i) => (avg[i] === null ? [] : [{ date: d, value: avg[i]! }]))
}
