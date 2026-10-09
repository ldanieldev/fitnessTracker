import { describe, expect, it } from 'vitest'
import {
  bestEstimate,
  brzycki,
  effectiveOneRepMax,
  estimateCacheKey,
  estimateWindowStart,
  historyStampKey,
  repMaxTable,
  repsToWeight
} from '../../shared/utils/oneRepMax'

describe('brzycki', () => {
  it('estimates a 1RM and inverts it', () => {
    expect(brzycki(225, 5)).toBeCloseTo(253.125)
    expect(brzycki(45, 1)).toBe(45)
    expect(repsToWeight(253.125, 5)).toBeCloseTo(225)
  })
})

describe('estimateWindowStart', () => {
  it('opens the 90-day window 89 days before the given day', () => {
    expect(estimateWindowStart('2026-09-18')).toBe('2026-06-21')
  })
})

describe('bestEstimate', () => {
  const on = '2026-09-18'

  it('picks the best qualifying set and reports it', () => {
    const best = bestEstimate([
      { weight: 200, reps: 3, performedOn: '2026-09-01' },
      { weight: 225, reps: 5, performedOn: '2026-09-02' }
    ], on)
    expect(best).toEqual({ estimate: 253.1, source: { weight: 225, reps: 5, performedOn: '2026-09-02' } })
  })

  it('ignores sets outside the window, over 10 reps, weightless or incomplete', () => {
    expect(bestEstimate([
      { weight: 300, reps: 5, performedOn: '2026-06-20' },
      { weight: 300, reps: 5, performedOn: '2026-09-19' },
      { weight: 300, reps: 11, performedOn: '2026-09-01' },
      { weight: 0, reps: 5, performedOn: '2026-09-01' },
      { weight: null, reps: 5, performedOn: '2026-09-01' },
      { weight: 300, reps: null, performedOn: '2026-09-01' }
    ], on)).toBeNull()
  })

  it('keeps the window edges', () => {
    expect(bestEstimate([{ weight: 100, reps: 1, performedOn: '2026-06-21' }], on)?.estimate).toBe(100)
    expect(bestEstimate([{ weight: 100, reps: 10, performedOn: on }], on)?.estimate).toBe(133.3)
  })

  it('prefers the newer set on a tie', () => {
    const best = bestEstimate([
      { weight: 100, reps: 1, performedOn: '2026-09-01' },
      { weight: 100, reps: 1, performedOn: '2026-09-10' }
    ], on)
    expect(best?.source.performedOn).toBe('2026-09-10')
  })
})

describe('repMaxTable', () => {
  it('lists 1RM to 15RM rounded to a tenth', () => {
    const table = repMaxTable(253.1)
    expect(table).toHaveLength(15)
    expect(table[0]).toEqual({ reps: 1, weight: 253.1 })
    expect(table[4]).toEqual({ reps: 5, weight: 225 })
  })
})

describe('effectiveOneRepMax', () => {
  const result = { estimate: 253.1, source: { weight: 225, reps: 5, performedOn: '2026-09-02' }, assisted: false }

  it('uses a complete override over the estimate', () => {
    expect(effectiveOneRepMax(result, { weight: 200, reps: 3 })).toBe(211.8)
  })

  it('falls back to the estimate when the override is blank or invalid', () => {
    expect(effectiveOneRepMax(result, { weight: null, reps: null })).toBe(253.1)
    expect(effectiveOneRepMax(result, { weight: 200, reps: 11 })).toBe(253.1)
    expect(effectiveOneRepMax(null, { weight: null, reps: null })).toBeNull()
  })

  it('honours a raised rep cap for the override, matching the caller-supplied cap', () => {
    expect(effectiveOneRepMax(result, { weight: 100, reps: 12 }, 12)).toBe(144)
    expect(effectiveOneRepMax(result, { weight: 100, reps: 12 })).toBe(253.1)
  })
})

describe('estimateCacheKey', () => {
  it('names one entry per user, exercise, day and rep cap', () => {
    const key = estimateCacheKey(1, 7, '2026-09-18', 10)
    expect(key).toBe('one-rep-max:1:7:2026-09-18:10')
    expect(estimateCacheKey(1, 7, '2026-09-19', 10)).not.toBe(key)
    expect(estimateCacheKey(1, 7, '2026-09-18', 12)).not.toBe(key)
  })
})

describe('historyStampKey', () => {
  it('changes whenever any part of the history stamp changes', () => {
    const stamp = { sets: 3, setsAt: '1790000000.1', sessionsAt: '1790000000.2', entriesAt: '1790000000.3' }
    const key = historyStampKey(stamp)
    expect(historyStampKey({ ...stamp, sets: 4 })).not.toBe(key)
    expect(historyStampKey({ ...stamp, setsAt: '1790000001.0' })).not.toBe(key)
    expect(historyStampKey({ ...stamp, sessionsAt: null })).not.toBe(key)
    expect(historyStampKey({ ...stamp, entriesAt: '1790000001.0' })).not.toBe(key)
  })
})
