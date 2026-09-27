import { describe, expect, it } from 'vitest'
import {
  metricLowerIsBetter,
  metricValue,
  metricsFor,
  rollupFrom,
  workoutTrend
} from '../../shared/utils/workoutMetrics'

const set = (weight: number | null, reps: number | null) => ({
  weight, reps, distanceMeters: null, durationSeconds: null
})

describe('rollupFrom', () => {
  it('sums volume and finds the top set for a plain weight/reps session', () => {
    const rollup = rollupFrom([set(185, 8), set(205, 5), set(205, 3)], 'plain', 10)
    expect(rollup.setCount).toBe(3)
    expect(rollup.totalReps).toBe(16)
    expect(rollup.totalVolume).toBe(185 * 8 + 205 * 5 + 205 * 3)
    expect(rollup.topWeight).toBe(205)
    expect(rollup.topWeightReps).toBe(5)
    expect(rollup.topSetVolume).toBe(185 * 8)
    expect(rollup.weightByReps).toEqual({ 3: 205, 5: 205, 8: 185 })
  })

  it('estimates the best 1RM only from sets at or under the cap', () => {
    expect(rollupFrom([set(100, 12)], 'plain', 10).bestE1rm).toBeNull()
    expect(rollupFrom([set(100, 5)], 'plain', 10).bestE1rm).toBeCloseTo(112.5, 1)
    expect(rollupFrom([set(100, 12)], 'plain', 12).bestE1rm).toBeCloseTo(144, 0)
  })

  it('treats an assisted session as lower-is-better and refuses volume', () => {
    const rollup = rollupFrom([set(40, 6), set(20, 5)], 'assisted', 10)
    expect(rollup.topWeight).toBe(20)
    expect(rollup.topWeightReps).toBe(5)
    expect(rollup.totalVolume).toBeNull()
    expect(rollup.topSetVolume).toBeNull()
    expect(rollup.bestE1rm).toBeNull()
    expect(rollup.weightByReps).toEqual({ 5: 20, 6: 40 })
  })

  it('rolls up a cardio session', () => {
    const rollup = rollupFrom([
      { weight: null, reps: null, distanceMeters: 5000, durationSeconds: 1500 },
      { weight: null, reps: null, distanceMeters: 1000, durationSeconds: 200 }
    ], null, 10)
    expect(rollup.totalDistanceMeters).toBe(6000)
    expect(rollup.totalDurationSeconds).toBe(1700)
    expect(rollup.bestPace).toBeCloseTo(5, 3)
    expect(rollup.totalVolume).toBeNull()
    expect(rollup.topWeight).toBeNull()
  })

  it('returns an empty rollup for no sets', () => {
    const rollup = rollupFrom([], 'plain', 10)
    expect(rollup).toMatchObject({ setCount: 0, totalReps: 0, totalVolume: null, weightByReps: {} })
  })
})

describe('metricsFor', () => {
  it('offers the strength metrics for weight and reps', () => {
    expect(metricsFor('weight_reps', 'plain')).toEqual([
      'e1rm', 'max_weight', 'volume', 'total_reps', 'weight_at_reps'
    ])
  })

  it('drops the estimate and volume for an assisted exercise', () => {
    expect(metricsFor('weight_reps', 'assisted')).toEqual(['max_weight', 'total_reps', 'weight_at_reps'])
  })

  it('offers distance, duration and pace for a cardio exercise', () => {
    expect(metricsFor('distance_time', null)).toEqual(['distance', 'duration', 'pace'])
  })

  it('offers reps alone for a bodyweight exercise', () => {
    expect(metricsFor('reps', null)).toEqual(['total_reps'])
  })
})

describe('metricValue', () => {
  const rollup = rollupFrom([set(185, 8), set(205, 5)], 'plain', 10)

  it('reads the matching field', () => {
    expect(metricValue(rollup, 'max_weight', null)).toBe(205)
    expect(metricValue(rollup, 'volume', null)).toBe(185 * 8 + 205 * 5)
    expect(metricValue(rollup, 'total_reps', null)).toBe(13)
  })

  it('reads weight_at_reps by rep count and is null where nothing was logged', () => {
    expect(metricValue(rollup, 'weight_at_reps', 8)).toBe(185)
    expect(metricValue(rollup, 'weight_at_reps', 6)).toBeNull()
    expect(metricValue(rollup, 'weight_at_reps', null)).toBeNull()
  })
})

describe('workoutTrend', () => {
  it('smooths sparse sessions across a 28-day window', () => {
    const points = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-08', value: 110 },
      { date: '2026-01-15', value: 120 }
    ]
    const trend = workoutTrend(points, '2026-01-01', '2026-01-15')
    expect(trend[trend.length - 1]!.value).toBeCloseTo(110, 5)
    expect(trend.every((p) => p.date >= '2026-01-01' && p.date <= '2026-01-15')).toBe(true)
  })

  it('returns nothing for an empty series', () => {
    expect(workoutTrend([], '2026-01-01', '2026-01-15')).toEqual([])
  })

  it('averages two sessions on the same day before building the trend', () => {
    const points = [
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-01', value: 200 }
    ]
    const trend = workoutTrend(points, '2026-01-01', '2026-01-01')
    expect(trend).toEqual([{ date: '2026-01-01', value: 150 }])
  })
})

describe('metricLowerIsBetter', () => {
  it('is true only for assisted max_weight and weight_at_reps', () => {
    expect(metricLowerIsBetter('max_weight', 'assisted')).toBe(true)
    expect(metricLowerIsBetter('weight_at_reps', 'assisted')).toBe(true)
    expect(metricLowerIsBetter('max_weight', 'barbell')).toBe(false)
    expect(metricLowerIsBetter('max_weight', null)).toBe(false)
    expect(metricLowerIsBetter('weight_at_reps', 'barbell')).toBe(false)
    expect(metricLowerIsBetter('e1rm', 'assisted')).toBe(false)
    expect(metricLowerIsBetter('volume', 'assisted')).toBe(false)
  })
})
