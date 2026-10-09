import { describe, expect, it } from 'vitest'
import type { WorkoutEntry, WorkoutSession, WorkoutSet } from '../../shared/types/workout'
import { workoutShareText } from '../../shared/utils/workoutShare'

let nextId = 1
const set = (over: Partial<WorkoutSet>): WorkoutSet => ({
  id: nextId++,
  sortOrder: 0,
  done: false,
  comment: null,
  records: [],
  weight: null,
  reps: null,
  distanceMeters: null,
  durationSeconds: null,
  ...over
})
const entry = (over: Partial<WorkoutEntry>): WorkoutEntry => ({
  id: nextId++,
  exerciseId: 1,
  exerciseName: 'Bench Press',
  sortOrder: 0,
  trackingType: 'weight_reps',
  loadStyle: 'barbell',
  barWeight: 45,
  weightIncrement: null,
  restSeconds: null,
  plateSizes: null,
  notes: null,
  target: null,
  supersetGroup: null,
  optional: false,
  restOverrideSeconds: null,
  sets: [],
  lastSets: [],
  ...over
})
const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: 1,
  name: 'Push A',
  performedOn: '2026-10-03',
  startedAt: '2026-10-03T15:00:00.000Z',
  endedAt: '2026-10-03T15:52:00.000Z',
  notes: null,
  routineDayId: null,
  deload: false,
  entries: [],
  ...over
})

describe('workoutShareText', () => {
  it('titles with name, date and duration, then each exercise with its sets', () => {
    const text = workoutShareText(
      session({
        entries: [entry({ sets: [set({ weight: 185, reps: 8 }), set({ weight: 185, reps: 7, comment: 'grindy' })] })]
      })
    )
    expect(text).toBe('Push A — Sat, Oct 3 · 52:00\n\nBench Press\n  185 lb × 8, 185 lb × 7 (grindy)')
  })

  it('labels supersets, signs assisted weights, formats time sets and skips empty exercises', () => {
    const a = entry({
      exerciseName: 'Dip',
      supersetGroup: 1,
      loadStyle: 'assisted',
      sets: [set({ weight: 20, reps: 8 })]
    })
    const b = entry({
      exerciseName: 'Curl',
      supersetGroup: 1,
      loadStyle: 'plain',
      sets: [set({ weight: 30, reps: 10 })]
    })
    const empty = entry({ exerciseName: 'Fly', sets: [] })
    const plank = entry({
      exerciseName: 'Plank',
      trackingType: 'time',
      loadStyle: null,
      sets: [set({ durationSeconds: 60 })]
    })
    const text = workoutShareText(
      session({ name: null, endedAt: null, notes: 'felt strong', entries: [a, b, empty, plank] })
    )
    expect(text).toBe(
      [
        'Workout — Sat, Oct 3',
        'Note: felt strong',
        '',
        'A1 Dip',
        '  -20 lb × 8',
        'A2 Curl',
        '  30 lb × 10',
        'Plank',
        '  1:00'
      ].join('\n')
    )
  })
})
