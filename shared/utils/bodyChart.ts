import type { SeriesPoint } from '../types/body'
import { dayIndex, daysBetween } from './bodyMetrics'
import { shiftDate } from './nutritionSummary'

export interface XY {
  x: number
  y: number
}

export interface Scale {
  (value: number): number
  domain: [number, number]
  range: [number, number]
}

export function scaleLinear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  const scale = ((value: number) => r0 + ((value - d0) / span) * (r1 - r0)) as Scale
  scale.domain = domain
  scale.range = range
  return scale
}

// d3's tick thresholds (√50, √10, √2) pick the 1/2/5/10 multiple nearest the rough step on a log scale.
export function niceStep(rough: number): number {
  const base = 10 ** Math.floor(Math.log10(rough))
  const f = rough / base
  return base * (f >= 7.07 ? 10 : f >= 3.16 ? 5 : f >= 1.41 ? 2 : 1)
}

function round6(v: number) {
  return Math.round(v * 1e6) / 1e6
}

export function niceTicks(min: number, max: number, count = 5): { min: number, max: number, ticks: number[] } {
  if (max - min === 0) {
    min -= 1
    max += 1
  }
  const step = niceStep((max - min) / (count - 1))
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(round6(v))
  return { min: round6(lo), max: round6(hi), ticks }
}

export function segmentByGap(points: SeriesPoint[], maxGapDays: number): SeriesPoint[][] {
  const segments: SeriesPoint[][] = []
  for (const p of points) {
    const current = segments[segments.length - 1]
    if (current && daysBetween(current[current.length - 1]!.date, p.date) <= maxGapDays) current.push(p)
    else segments.push([p])
  }
  return segments
}

const fmt = (n: number) => String(Math.round(n * 10) / 10)

function lineOf(segment: XY[]): string {
  return segment.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`).join(' ')
}

export function pathFrom(segments: XY[][]): string {
  return segments.filter((s) => s.length > 0).map(lineOf).join(' ')
}

export function areaFrom(segments: XY[][], baselineY: number): string {
  return segments
    .filter((s) => s.length > 0)
    .map((s) => `${lineOf(s)} L${fmt(s[s.length - 1]!.x)} ${fmt(baselineY)} L${fmt(s[0]!.x)} ${fmt(baselineY)} Z`)
    .join(' ')
}

export function dateTicks(from: string, to: string, count: number): string[] {
  const span = daysBetween(from, to)
  if (span <= 0 || count <= 1) return [from]
  const out = new Set<string>()
  for (let i = 0; i < count; i++) out.add(shiftDate(from, Math.round((span * i) / (count - 1))))
  return [...out]
}

export function nearestPoint<T extends { x: number }>(dots: T[], x: number): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const dot of dots) {
    const dist = Math.abs(dot.x - x)
    if (dist < bestDist) {
      best = dot
      bestDist = dist
    }
  }
  return best
}

export interface ChartDot extends XY {
  date: string
  value: number
}

export interface ChartModel {
  width: number
  height: number
  plot: { left: number, right: number, top: number, bottom: number }
  x: Scale
  y: Scale
  yTicks: Array<{ value: number, y: number }>
  xTicks: Array<{ date: string, x: number }>
  rawPath: string
  areaPath: string
  trendPath: string
  goalY: number | null
  dots: ChartDot[]
}

export interface ChartInput {
  points: SeriesPoint[]
  trend: SeriesPoint[]
  goal: number | null
  from: string
  to: string
  width: number
  height: number
  gapDays: number
}

const PAD = { left: 40, right: 8, top: 8, bottom: 20 }

export function buildChartModel(input: ChartInput): ChartModel {
  const plot = { left: PAD.left, right: input.width - PAD.right, top: PAD.top, bottom: input.height - PAD.bottom }
  const values = [...input.points.map((p) => p.value), ...input.trend.map((p) => p.value)]
  const lo = values.length ? Math.min(...values) : 0
  const hi = values.length ? Math.max(...values) : 1
  const pad = (hi - lo) * 0.05
  const nice = niceTicks(lo - pad, hi + pad)
  const y = scaleLinear([nice.min, nice.max], [plot.bottom, plot.top])
  const x = scaleLinear([dayIndex(input.from), dayIndex(input.to)], [plot.left, plot.right])
  const toDot = (p: SeriesPoint): ChartDot => ({ date: p.date, value: p.value, x: x(dayIndex(p.date)), y: y(p.value) })
  const rawSegments = segmentByGap(input.points, input.gapDays).map((s) => s.map(toDot))
  const trendSegments = segmentByGap(input.trend, input.gapDays).map((s) => s.map(toDot))
  return {
    width: input.width,
    height: input.height,
    plot,
    x,
    y,
    yTicks: nice.ticks.map((value) => ({ value, y: y(value) })),
    xTicks: dateTicks(input.from, input.to, input.width < 400 ? 3 : 5).map((date) => ({ date, x: x(dayIndex(date)) })),
    rawPath: pathFrom(rawSegments),
    areaPath: areaFrom(rawSegments, plot.bottom),
    trendPath: pathFrom(trendSegments),
    goalY: input.goal === null ? null : Math.min(Math.max(y(input.goal), plot.top), plot.bottom),
    dots: rawSegments.flat()
  }
}
