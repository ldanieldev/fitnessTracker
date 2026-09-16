export type MeasurementDirection = 'lower' | 'higher' | 'neutral'
export type SeriesGranularity = 'day' | 'week'
export type BodyRange = 'mtd' | '1m' | '3m' | '6m' | '1y' | 'all'
export interface MeasurementType { id: number, key: string | null, name: string, unit: string, precision: number, direction: MeasurementDirection, builtIn: boolean, hidden: boolean, sortOrder: number | null }
export interface MeasurementEntry { id: number, typeId: number, value: number, measuredAt: string, measuredOn: string } // measuredAt ISO instant, measuredOn YYYY-MM-DD
export interface SeriesPoint { date: string, value: number }
export interface MeasurementGoal { typeId: number, targetValue: number, targetDate: string | null, startValue: number, startDate: string }
export interface MetricOverview { type: MeasurementType, latest: MeasurementEntry | null, previous: MeasurementEntry | null, goal: MeasurementGoal | null, sparkline: SeriesPoint[] }
export interface MetricSeries { type: MeasurementType, goal: MeasurementGoal | null, latest: MeasurementEntry | null, granularity: SeriesGranularity, from: string, to: string, points: SeriesPoint[] }
export interface GoalOverview { type: MeasurementType, goal: MeasurementGoal, latest: MeasurementEntry | null }
