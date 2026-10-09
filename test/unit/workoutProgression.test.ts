import { describe, expect, it } from 'vitest'
import type { SetMeasures } from '../../shared/types/workout'
import { progressionCopy, progressionFor } from '../../shared/utils/workoutProgression'

const s = (weight: number | null, reps: number | null): SetMeasures => ({ weight, reps })

const entry = (over: Partial<Parameters<typeof progressionFor>[0]> = {}): Parameters<typeof progressionFor>[0] => ({
  trackingType: 'weight_reps',
  loadStyle: 'plain',
  weightIncrement: 10,
  target: { sets: 3, low: 4, high: 6, weight: null },
  sets: [],
  lastSets: [],
  ...over
})

const today = (...sets: SetMeasures[]) =>
  sets.map((set, i) => ({
    id: i + 1,
    sortOrder: i,
    distanceMeters: null,
    durationSeconds: null,
    done: false,
    comment: null,
    records: [],
    ...set
  }))

describe('progressionFor', () => {
  it('adds the increment after a top-of-range set today', () => {
    expect(progressionFor(entry({ sets: today(s(185, 6)) }), false)).toEqual({
      kind: 'add',
      weight: 195,
      fromWeight: 185,
      reps: 6
    })
  })

  it('counts reps above the top as the top', () => {
    expect(progressionFor(entry({ sets: today(s(185, 8)) }), false)?.weight).toBe(195)
  })

  it('bumps the first set of a session from the last set of the previous one', () => {
    expect(progressionFor(entry({ lastSets: [s(185, 5), s(185, 6)] }), false)).toEqual({
      kind: 'add',
      weight: 195,
      fromWeight: 185,
      reps: 6
    })
  })

  it('stays quiet inside the range', () => {
    expect(progressionFor(entry({ sets: today(s(185, 5)) }), false)).toBeNull()
  })

  it('falls back to 5 lb when the exercise has no increment', () => {
    expect(progressionFor(entry({ weightIncrement: null, sets: today(s(185, 6)) }), false)?.weight).toBe(190)
  })

  it('needs a real range: fixed reps and no target never cue', () => {
    expect(
      progressionFor(entry({ target: { sets: 3, low: 5, high: 5, weight: null }, sets: today(s(185, 5)) }), false)
    ).toBeNull()
    expect(
      progressionFor(entry({ target: { sets: 3, low: null, high: 6, weight: null }, sets: today(s(185, 6)) }), false)
    ).toBeNull()
    expect(progressionFor(entry({ target: null, sets: today(s(185, 6)) }), false)).toBeNull()
  })

  it('only applies to weight_reps', () => {
    expect(progressionFor(entry({ trackingType: 'weight_time', sets: today(s(185, null)) }), false)).toBeNull()
  })

  it('needs weight and reps on the trigger set', () => {
    expect(progressionFor(entry({ sets: today(s(null, 6)) }), false)).toBeNull()
    expect(progressionFor(entry({ sets: today(s(185, null)) }), false)).toBeNull()
    expect(progressionFor(entry(), false)).toBeNull()
  })

  it('suppresses the add in a deload', () => {
    expect(progressionFor(entry({ sets: today(s(185, 6)) }), true)).toBeNull()
  })

  it('drops back to the old load after a failed bump', () => {
    expect(progressionFor(entry({ sets: today(s(185, 6), s(195, 3)) }), false)).toEqual({
      kind: 'drop',
      weight: 185,
      fromWeight: 195,
      reps: 3
    })
  })

  it('drops back even in a deload', () => {
    expect(progressionFor(entry({ sets: today(s(185, 6), s(195, 3)) }), true)?.kind).toBe('drop')
  })

  it('a bump that lands in range is not a failure', () => {
    expect(progressionFor(entry({ sets: today(s(185, 6), s(195, 4)) }), false)).toBeNull()
  })

  it('ramp-up below range is silent', () => {
    expect(progressionFor(entry({ sets: today(s(135, 5), s(185, 3)) }), false)).toBeNull()
  })

  it('allows one attempt per session: no re-add after a failed bump today', () => {
    expect(progressionFor(entry({ sets: today(s(185, 6), s(195, 3), s(185, 6)) }), false)).toBeNull()
  })

  it('a failed bump across the session boundary counts for today', () => {
    expect(progressionFor(entry({ lastSets: [s(185, 6)], sets: today(s(195, 3)) }), false)?.kind).toBe('drop')
    expect(progressionFor(entry({ lastSets: [s(185, 6)], sets: today(s(195, 3), s(185, 6)) }), false)).toBeNull()
  })

  it('a failed bump that ended last session drops today and still allows one attempt', () => {
    const lastSets = [s(185, 6), s(195, 3)]
    expect(progressionFor(entry({ lastSets }), false)).toEqual({ kind: 'drop', weight: 185, fromWeight: 195, reps: 3 })
    expect(progressionFor(entry({ lastSets, sets: today(s(185, 6)) }), false)?.kind).toBe('add')
  })

  it('inverts for assisted exercises', () => {
    const assisted = { loadStyle: 'assisted' as const }
    expect(progressionFor(entry({ ...assisted, sets: today(s(40, 6)) }), false)).toEqual({
      kind: 'add',
      weight: 30,
      fromWeight: 40,
      reps: 6
    })
    expect(progressionFor(entry({ ...assisted, sets: today(s(40, 6), s(30, 3)) }), false)).toEqual({
      kind: 'drop',
      weight: 40,
      fromWeight: 30,
      reps: 3
    })
    expect(progressionFor(entry({ ...assisted, sets: today(s(40, 6), s(50, 3)) }), false)).toBeNull()
  })

  it('rounds non-binary increments to 2 decimals', () => {
    expect(progressionFor(entry({ weightIncrement: 2.2, sets: today(s(47.2, 6)) }), false)).toEqual({
      kind: 'add',
      weight: 49.4,
      fromWeight: 47.2,
      reps: 6
    })
    expect(
      progressionFor(entry({ loadStyle: 'assisted', weightIncrement: 2.5, sets: today(s(33.3, 6)) }), false)
    ).toEqual({ kind: 'add', weight: 30.8, fromWeight: 33.3, reps: 6 })
  })

  it('assisted never suggests zero assist', () => {
    expect(progressionFor(entry({ loadStyle: 'assisted', sets: today(s(10, 6)) }), false)).toBeNull()
    expect(progressionFor(entry({ loadStyle: 'assisted', sets: today(s(5, 6)) }), false)).toBeNull()
  })

  describe('progressionCopy', () => {
    const target = { sets: 3, low: 4, high: 6, weight: null }

    it('words an add', () => {
      expect(progressionCopy({ kind: 'add', weight: 155, fromWeight: 150, reps: 6 }, 'plain', target)).toMatchObject({
        title: 'Add weight?',
        body: 'You hit 6 reps at 150 lb — the top of 4–6.',
        apply: 'Add 5 lb → 155 lb',
        stay: 'Stay at 150 lb'
      })
    })

    it('words a drop', () => {
      expect(progressionCopy({ kind: 'drop', weight: 150, fromWeight: 155, reps: 3 }, 'barbell', target)).toMatchObject(
        {
          title: 'Drop back?',
          body: '3 reps at 155 lb is below 4–6.',
          apply: 'Drop to 150 lb',
          stay: 'Stay at 155 lb'
        }
      )
    })

    it('words assisted add and drop', () => {
      const add = progressionCopy({ kind: 'add', weight: 30, fromWeight: 40, reps: 6 }, 'assisted', target)
      expect(add.title).toBe('Less assist?')
      expect(add.body).toBe('You hit 6 reps at 40 lb — the top of 4–6.')
      expect(add.apply).toBe('Less assist → 30 lb')
      const drop = progressionCopy({ kind: 'drop', weight: 40, fromWeight: 30, reps: 3 }, 'assisted', target)
      expect(drop.title).toBe('More assist?')
      expect(drop.body).toBe('3 reps at 30 lb is below 4–6.')
      expect(drop.apply).toBe('More assist → 40 lb')
    })

    it('splits the body around the range', () => {
      const parts = progressionCopy({ kind: 'add', weight: 155, fromWeight: 150, reps: 6 }, 'plain', target).bodyParts
      expect(parts).toEqual({ before: 'You hit 6 reps at 150 lb — the top of ', range: '4–6', after: '.' })
    })

    it('rounds the step to 2 decimals', () => {
      expect(progressionCopy({ kind: 'add', weight: 49.4, fromWeight: 47.2, reps: 6 }, 'plain', target).apply).toBe(
        'Add 2.2 lb → 49.4 lb'
      )
    })
  })
})
