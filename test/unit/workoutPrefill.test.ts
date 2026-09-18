import { describe, expect, it } from 'vitest'
import { lastTimeFor, prefillFor } from '../../shared/utils/workoutPrefill'

const last = [{ weight: 185, reps: 8 }, { weight: 185, reps: 7 }, { weight: 175, reps: 6 }]

describe('prefillFor', () => {
  it('copies the previous set of this session', () => {
    expect(prefillFor([{ weight: 200, reps: 5 }], last)).toEqual({ weight: 200, reps: 5 })
  })

  it('copies the last set of the previous session when today has none', () => {
    expect(prefillFor([], last)).toEqual({ weight: 175, reps: 6 })
  })

  it('returns an empty set when there is no history at all', () => {
    expect(prefillFor([], [])).toEqual({})
  })

  it('copies the most recent set, not the first', () => {
    const today = [{ weight: 100, reps: 10 }, { weight: 110, reps: 9 }]
    expect(prefillFor(today, last)).toEqual({ weight: 110, reps: 9 })
  })
})

describe('lastTimeFor', () => {
  it('pairs by position', () => {
    expect(lastTimeFor(0, last)).toEqual({ weight: 185, reps: 8 })
    expect(lastTimeFor(2, last)).toEqual({ weight: 175, reps: 6 })
  })

  it('keeps showing the final set past the end', () => {
    expect(lastTimeFor(5, last)).toEqual({ weight: 175, reps: 6 })
  })

  it('has nothing to show without a previous session', () => {
    expect(lastTimeFor(0, [])).toBe(null)
  })
})
