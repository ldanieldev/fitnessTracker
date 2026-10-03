import { describe, expect, it } from 'vitest'
import {
  copyTargetsFrom, formatTargetRange, rangePlaceholder, targetMetricFor, targetProgressLabel, targetSummary
} from '../../shared/utils/workoutTargets'

describe('targetMetricFor', () => {
  it('prefers reps, then time, then distance', () => {
    expect(targetMetricFor('weight_reps')).toBe('reps')
    expect(targetMetricFor('reps_time')).toBe('reps')
    expect(targetMetricFor('weight_time')).toBe('time')
    expect(targetMetricFor('distance_time')).toBe('time')
    expect(targetMetricFor('weight_distance')).toBe('distance')
    expect(targetMetricFor('weight')).toBeNull()
  })
})

describe('copyTargetsFrom', () => {
  it('counts the sets and spans the reps actually done', () => {
    const sets = [{ weight: 185, reps: 8 }, { weight: 185, reps: 7 }, { weight: 185, reps: 6 }, { weight: 185, reps: 6 }]
    expect(copyTargetsFrom('weight_reps', sets, null)).toEqual({ sets: 4, low: 6, high: 8, weight: null })
  })

  it('keeps the source range when the source had one', () => {
    const source = { sets: 3, low: 5, high: 8, weight: 200 }
    expect(copyTargetsFrom('weight_reps', [{ weight: 185, reps: 9 }], source))
      .toEqual({ sets: 1, low: 5, high: 8, weight: null })
  })

  it('collapses a single value to low = high and reads seconds for time exercises', () => {
    expect(copyTargetsFrom('time', [{ durationSeconds: 45 }], null)).toEqual({ sets: 1, low: 45, high: 45, weight: null })
  })

  it('returns null when nothing was logged and the source had no range', () => {
    expect(copyTargetsFrom('weight_reps', [], null)).toBeNull()
  })
})

describe('formatting', () => {
  it('formats ranges per metric', () => {
    expect(formatTargetRange('reps', 5, 8)).toBe('5–8')
    expect(formatTargetRange('reps', 8, 8)).toBe('8')
    expect(formatTargetRange('reps', null, 12)).toBe('12')
    expect(formatTargetRange('time', 30, 45)).toBe('30–45 s')
    expect(formatTargetRange('time', 900, 1200)).toBe('15–20 min')
    expect(formatTargetRange('distance', 400, 800)).toBe('400–800 m')
    expect(formatTargetRange('reps', null, null)).toBe('')
  })

  it('builds the input placeholder from the raw values', () => {
    expect(rangePlaceholder(5, 8)).toBe('5–8')
    expect(rangePlaceholder(8, 8)).toBe('8')
    expect(rangePlaceholder(null, null)).toBeNull()
  })

  it('summarises a routine row', () => {
    expect(targetSummary('weight_reps', { sets: 3, low: 5, high: 8, weight: null })).toBe('3 × 5–8')
    expect(targetSummary('weight_reps', { sets: 3, low: null, high: null, weight: null })).toBe('3 sets')
    expect(targetSummary('time', { sets: null, low: 900, high: 1200, weight: null })).toBe('15–20 min')
    expect(targetSummary('weight_reps', { sets: 3, low: 5, high: 8, weight: 135 })).toBe('3 × 5–8 @ 135 lb')
    expect(targetSummary('weight_reps', null)).toBe('')
  })

  it('labels progress on the log card', () => {
    const target = { sets: 3, low: 5, high: 8, weight: null }
    expect(targetProgressLabel('weight_reps', target, 1)).toBe('1 of 3 · 5–8')
    expect(targetProgressLabel('weight_reps', target, 4)).toBe('4 of 3 · 5–8')
    expect(targetProgressLabel('weight_reps', { ...target, low: null, high: null }, 0)).toBe('0 of 3')
    expect(targetProgressLabel('time', { sets: null, low: 30, high: 45, weight: null }, 2)).toBe('30–45 s')
    expect(targetProgressLabel('weight_reps', null, 2)).toBeNull()
  })
})
