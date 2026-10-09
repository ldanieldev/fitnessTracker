import { describe, expect, it } from 'vitest'
import { formatSet, measureText } from '../../shared/utils/setFormat'

describe('formatSet', () => {
  it('writes weight and reps as before', () => {
    expect(formatSet(['weight', 'reps'], { weight: 185, reps: 8 })).toBe('185 lb × 8')
  })

  it('writes distance in miles and duration as a clock', () => {
    expect(formatSet(['distance', 'duration'], { distanceMeters: 5000, durationSeconds: 1800 })).toBe('3.11 mi × 30:00')
    expect(formatSet(['duration'], { durationSeconds: 3930 })).toBe('1:05:30')
    expect(formatSet(['weight', 'distance'], { weight: 90, distanceMeters: 402.34 })).toBe('90 lb × 0.25 mi')
  })

  it('leaves a missing measure blank', () => {
    expect(formatSet(['distance', 'duration'], { distanceMeters: null, durationSeconds: 60 })).toBe(' × 1:00')
  })
})

describe('measureText', () => {
  it('formats one value per measure', () => {
    expect(measureText('weight', 185)).toBe('185 lb')
    expect(measureText('reps', 8)).toBe('8')
    expect(measureText('distance', 1609.344)).toBe('1 mi')
    expect(measureText('duration', 45)).toBe('0:45')
  })
})
