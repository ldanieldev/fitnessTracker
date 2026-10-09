import { describe, expect, it } from 'vitest'
import { measuresFor, validateSetInput } from '../../shared/utils/setRules'

describe('measuresFor', () => {
  it('splits each compound tracking type into its measures', () => {
    expect(measuresFor('weight_reps')).toEqual(['weight', 'reps'])
    expect(measuresFor('distance_time')).toEqual(['distance', 'duration'])
    expect(measuresFor('reps_time')).toEqual(['reps', 'duration'])
    expect(measuresFor('weight_distance')).toEqual(['weight', 'distance'])
  })

  it('covers the remaining compound types', () => {
    expect(measuresFor('weight_time')).toEqual(['weight', 'duration'])
    expect(measuresFor('reps_distance')).toEqual(['reps', 'distance'])
  })

  it('gives single-measure types one measure', () => {
    expect(measuresFor('reps')).toEqual(['reps'])
    expect(measuresFor('time')).toEqual(['duration'])
    expect(measuresFor('distance')).toEqual(['distance'])
    expect(measuresFor('weight')).toEqual(['weight'])
  })
})

describe('validateSetInput', () => {
  it('accepts a set carrying exactly the measures its type uses', () => {
    expect(validateSetInput('weight_reps', { weight: 185, reps: 8 })).toBe(null)
    expect(validateSetInput('reps', { reps: 12 })).toBe(null)
  })

  it('rejects a missing measure', () => {
    expect(validateSetInput('weight_reps', { weight: 185 })).toBe('Reps is required')
    expect(validateSetInput('distance_time', { distanceMeters: 1609 })).toBe('Duration is required')
  })

  it('rejects a measure the type does not use', () => {
    expect(validateSetInput('reps', { reps: 12, weight: 100 })).toBe('Weight does not apply to this exercise')
  })

  it('rejects zero and negative measures', () => {
    expect(validateSetInput('weight_reps', { weight: 185, reps: 0 })).toBe('Reps must be greater than zero')
    expect(validateSetInput('weight_reps', { weight: -5, reps: 8 })).toBe('Weight must be greater than zero')
  })

  it('treats null and undefined the same way', () => {
    expect(validateSetInput('reps', { reps: null })).toBe('Reps is required')
    expect(validateSetInput('reps', {})).toBe('Reps is required')
  })
})
