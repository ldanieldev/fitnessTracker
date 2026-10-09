import type { ChartRange, SeriesGranularity, SeriesPoint } from './series'

export type BodyRange = ChartRange

export type MeasurementDirection = 'lower' | 'higher' | 'neutral'

export interface MeasurementType {
  id: number
  key: string | null
  name: string
  unit: string
  precision: number
  direction: MeasurementDirection
  builtIn: boolean
  hidden: boolean
  sortOrder: number | null
}

// measuredAt is an ISO instant, measuredOn is YYYY-MM-DD
export interface MeasurementEntry {
  id: number
  typeId: number
  value: number
  measuredAt: string
  measuredOn: string
}

export interface MeasurementGoal {
  typeId: number
  targetValue: number
  targetDate: string | null
  startValue: number
  startDate: string
}

export interface MetricOverview {
  type: MeasurementType
  latest: MeasurementEntry | null
  previous: MeasurementEntry | null
  goal: MeasurementGoal | null
  sparkline: SeriesPoint[]
}

export interface MetricSeries {
  type: MeasurementType
  goal: MeasurementGoal | null
  latest: MeasurementEntry | null
  granularity: SeriesGranularity
  from: string
  to: string
  points: SeriesPoint[]
}

export interface GoalOverview {
  type: MeasurementType
  goal: MeasurementGoal
  latest: MeasurementEntry | null
}
