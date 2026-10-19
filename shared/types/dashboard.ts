import type { MeasurementDirection } from './body'
import type { GraphMetric } from './workout'

export type DashboardPart = 'bodyweight' | 'consistency' | 'strength' | 'nutrition'

export interface DateRange {
  from: string
  to: string
}

export interface BodyweightTrend {
  typeId: number
  unit: string
  precision: number
  direction: MeasurementDirection
  current: number | null
  latest: { value: number; date: string } | null
  previous: { value: number; date: string } | null
  change: number | null
  week: { from: string; to: string }
  series: number[]
  daily: number[]
  goal: { targetValue: number; startValue: number } | null
}

export interface ConsistencyWeek {
  start: string
  target: number
  count: number
  met: boolean | null
}

export interface Consistency {
  weekStart: 0 | 1
  weeks: ConsistencyWeek[]
  days: string[]
  streak: number
  best: number
  thisWeek: { count: number; target: number }
  targetSource: 'program' | 'setting'
}

export interface StrengthLift {
  exerciseId: number
  name: string
  metric: GraphMetric
  unit: string
  value: number
  change: number | null
  lowerIsBetter: boolean
  goal: { targetValue: number; targetReps: number | null; progress: number } | null
  series: number[]
}

export interface Strength {
  lifts: StrengthLift[]
}

export interface NutritionStreak {
  weekStart: 0 | 1
  days: string[]
  streak: number
  best: number
  lastWeek: number
}

export interface CalendarDay {
  date: string
  future: boolean
}

export interface CalendarColumn {
  start: string
  month: string | null
  days: CalendarDay[]
}

export interface ProgramWindow {
  week: number
  currentWeekStart: string
  phases: { weeks: number; deload: boolean; routine: { dayCount: number } | null }[]
}

export interface LiftPoint {
  date: string
  value: number
}
