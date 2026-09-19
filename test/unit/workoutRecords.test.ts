import { describe, expect, it } from 'vitest'
import { paceOf, recordsFor, recordsForEarlier } from '../../shared/utils/workoutRecords'

const set = (id: number, measures: Record<string, number>) => ({ id, ...measures })

describe('recordsFor: weight for reps', () => {
  const history = [set(1, { weight: 185, reps: 8 }), set(2, { weight: 225, reps: 5 })]

  it('flags a heavier set at the same rep count', () => {
    const records = recordsFor(set(3, { weight: 190, reps: 8 }), history, 'weight_reps', 'plain')
    expect(records).toEqual([{ kind: 'weight_reps', previous: 185 }])
  })

  it('ignores a heavier set at a different rep count it does not beat', () => {
    expect(recordsFor(set(3, { weight: 200, reps: 5 }), history, 'weight_reps', 'plain')).toEqual([])
  })

  it('treats a tie as no record', () => {
    expect(recordsFor(set(3, { weight: 185, reps: 8 }), history, 'weight_reps', 'plain')).toEqual([])
  })

  it('WT-R16: a first set at a new rep count that beats nothing is no record', () => {
    expect(recordsFor(set(3, { weight: 135, reps: 12 }), history, 'weight_reps', 'plain')).toEqual([])
  })

  it('WT-R16: a first-ever set with no history is no record', () => {
    expect(recordsFor(set(1, { weight: 185, reps: 8 }), [], 'weight_reps', 'plain')).toEqual([])
    expect(recordsFor(set(1, { reps: 12 }), [], 'reps', null)).toEqual([])
    expect(recordsFor(set(1, { distanceMeters: 5000 }), [], 'distance', null)).toEqual([])
    expect(recordsFor(set(1, { distanceMeters: 5000, durationSeconds: 1800 }), [], 'distance_time', null)).toEqual([])
  })

  it('inverts for assisted exercises, so less assistance wins', () => {
    const assisted = [set(1, { weight: 40, reps: 8 })]
    expect(recordsFor(set(2, { weight: 30, reps: 8 }), assisted, 'weight_reps', 'assisted'))
      .toEqual([{ kind: 'weight_reps', previous: 40 }])
    expect(recordsFor(set(2, { weight: 50, reps: 8 }), assisted, 'weight_reps', 'assisted')).toEqual([])
    expect(recordsFor(set(1, { weight: 40, reps: 8 }), [], 'weight_reps', 'assisted')).toEqual([])
    expect(recordsFor(set(2, { weight: 30, reps: 6 }), [set(1, { weight: 40, reps: 8 })], 'weight_reps', 'assisted')).toEqual([])
  })

  it('LG-R19: a dominated set is no record, however different the rep count', () => {
    const opener = [set(1, { weight: 115, reps: 16 })]
    const second = set(2, { weight: 115, reps: 15 })
    expect(recordsFor(second, opener, 'weight_reps', 'plain')).toEqual([])
    expect(recordsFor(set(3, { weight: 115, reps: 13 }), [...opener, second], 'weight_reps', 'plain')).toEqual([])
  })

  it('WT-R16: heavier at fewer reps is no record unless it beats an earlier set on both axes', () => {
    const earlier = [set(1, { weight: 115, reps: 16 }), set(2, { weight: 115, reps: 14 })]
    expect(recordsFor(set(3, { weight: 120, reps: 15 }), earlier, 'weight_reps', 'plain'))
      .toEqual([{ kind: 'weight_reps', previous: 115 }])
    expect(recordsFor(set(2, { weight: 120, reps: 15 }), [set(1, { weight: 115, reps: 16 })], 'weight_reps', 'plain')).toEqual([])
  })

  it('LG-R19: more reps at the same weight is a record with no previous value at that rep count', () => {
    const opener = [set(1, { weight: 115, reps: 16 })]
    expect(recordsFor(set(2, { weight: 115, reps: 17 }), opener, 'weight_reps', 'plain'))
      .toEqual([{ kind: 'weight_reps', previous: null }])
  })

  it('LG-R19: assistance dominates on less assistance and more reps', () => {
    const history = [set(1, { weight: 40, reps: 8 }), set(2, { weight: 40, reps: 6 })]
    expect(recordsFor(set(3, { weight: 30, reps: 6 }), history, 'weight_reps', 'assisted'))
      .toEqual([{ kind: 'weight_reps', previous: 40 }])
    const after = [...history, set(3, { weight: 30, reps: 6 })]
    expect(recordsFor(set(4, { weight: 45, reps: 8 }), after, 'weight_reps', 'assisted')).toEqual([])
  })

  it('excludes the set being evaluated from its own history', () => {
    const withSelf = [set(3, { weight: 190, reps: 8 }), ...history]
    const records = recordsFor(set(3, { weight: 190, reps: 8 }), withSelf, 'weight_reps', 'plain')
    expect(records).toEqual([{ kind: 'weight_reps', previous: 185 }])
  })
})

describe('recordsFor: reps, distance and pace', () => {
  it('flags the most reps in a single set for a reps-only exercise', () => {
    const history = [set(1, { reps: 12 })]
    expect(recordsFor(set(2, { reps: 15 }), history, 'reps', null)).toEqual([{ kind: 'reps', previous: 12 }])
    expect(recordsFor(set(2, { reps: 12 }), history, 'reps', null)).toEqual([])
  })

  it('flags the longest distance', () => {
    const history = [set(1, { distanceMeters: 5000, durationSeconds: 1800 })]
    const records = recordsFor(set(2, { distanceMeters: 8000, durationSeconds: 3000 }), history, 'distance_time', null)
    expect(records).toContainEqual({ kind: 'distance', previous: 5000 })
  })

  it('flags a better pace alongside the distance', () => {
    const history = [set(1, { distanceMeters: 5000, durationSeconds: 1800 })]
    const records = recordsFor(set(2, { distanceMeters: 5000, durationSeconds: 1500 }), history, 'distance_time', null)
    expect(records).toEqual([{ kind: 'pace', previous: 5000 / 1800 }])
  })

  it('skips pace when a set carries only one of the two measures', () => {
    const history = [set(1, { distanceMeters: 5000 })]
    expect(recordsFor(set(2, { distanceMeters: 8000 }), history, 'distance', null))
      .toEqual([{ kind: 'distance', previous: 5000 }])
  })
})

describe('recordsForEarlier: LG-R5 partition', () => {
  it('treats array position as chronological order, not set id (earlier-dated session, higher id)', () => {
    const history = [set(50, { weight: 200, reps: 5 }), set(10, { weight: 210, reps: 5 })]
    expect(recordsForEarlier(history, 10, 'weight_reps', 'plain')).toEqual([{ kind: 'weight_reps', previous: 200 }])
  })

  it('never looks ahead: rows positioned after the set are not "earlier" even with a lower id', () => {
    const history = [set(5, { weight: 135, reps: 8 }), set(10, { weight: 185, reps: 8 }), set(50, { weight: 225, reps: 8 })]
    expect(recordsForEarlier(history, 10, 'weight_reps', 'plain')).toEqual([{ kind: 'weight_reps', previous: 135 }])
  })

  it('WT-R16: one session of 175x5, 175x6 and 205x6 records only the two sets that progress', () => {
    const history = [
      set(1, { weight: 175, reps: 5 }),
      set(2, { weight: 175, reps: 5 }),
      set(3, { weight: 175, reps: 6 }),
      set(4, { weight: 175, reps: 6 }),
      set(5, { weight: 175, reps: 6 }),
      set(6, { weight: 205, reps: 6 })
    ]
    const records = history.map((h) => recordsForEarlier(history, h.id, 'weight_reps', 'plain'))
    expect(records).toEqual([
      [],
      [],
      [{ kind: 'weight_reps', previous: null }],
      [],
      [],
      [{ kind: 'weight_reps', previous: 175 }]
    ])
  })

  it('treats a tie against an earlier set as no record', () => {
    const history = [set(10, { weight: 185, reps: 8 }), set(20, { weight: 185, reps: 8 })]
    expect(recordsForEarlier(history, 20, 'weight_reps', 'plain')).toEqual([])
  })

  it('returns no records when the set is missing from the history', () => {
    expect(recordsForEarlier([], 99, 'weight_reps', 'plain')).toEqual([])
  })
})

describe('paceOf', () => {
  it('is metres per second', () => {
    expect(paceOf({ distanceMeters: 1000, durationSeconds: 250 })).toBe(4)
  })

  it('is null without both measures', () => {
    expect(paceOf({ distanceMeters: 1000 })).toBe(null)
    expect(paceOf({ durationSeconds: 250 })).toBe(null)
  })
})
