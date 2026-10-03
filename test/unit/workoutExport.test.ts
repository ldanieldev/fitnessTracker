import { describe, expect, it } from 'vitest'
import { WORKOUT_CSV_HEADER, toWorkoutCsv, type WorkoutCsvRow } from '../../shared/utils/workoutExport'

const row = (over: Partial<WorkoutCsvRow> = {}): WorkoutCsvRow => ({
  date: '2026-10-01',
  workout: 'Push A',
  exercise: 'Bench Press',
  category: 'Chest',
  set: 1,
  weight: 185,
  reps: 8,
  distanceMeters: null,
  durationSeconds: null,
  superset: null,
  comment: null,
  workoutComment: null,
  ...over
})

describe('toWorkoutCsv', () => {
  it('writes the header first', () => {
    expect(toWorkoutCsv([]).split('\n')[0]).toBe(WORKOUT_CSV_HEADER.join(','))
    expect(WORKOUT_CSV_HEADER).toEqual([
      'Date', 'Workout', 'Exercise', 'Category', 'Set', 'Weight', 'Weight unit', 'Reps', 'Distance',
      'Distance unit', 'Duration (s)', 'Superset', 'Comment', 'Workout comment'
    ])
  })

  it('fills units only when the measure is present', () => {
    const [, weighted, cardio] = toWorkoutCsv([
      row(),
      row({ exercise: 'Row', weight: null, reps: null, distanceMeters: 2000, durationSeconds: 480 })
    ]).split('\n')
    expect(weighted).toBe('2026-10-01,Push A,Bench Press,Chest,1,185,lb,8,,,,,,')
    expect(cardio).toBe('2026-10-01,Push A,Row,Chest,1,,,,2000,m,480,,,')
  })

  it('keeps negative assisted weights, superset labels and escapes hostile text', () => {
    const line = toWorkoutCsv([
      row({ workout: 'Pull, "heavy"', weight: -20, superset: 'A2', comment: 'grip\nslipped', workoutComment: 'ok' })
    ]).split('\n').slice(1).join('\n')
    expect(line).toBe('2026-10-01,"Pull, ""heavy""",Bench Press,Chest,1,-20,lb,8,,,,A2,"grip\nslipped",ok')
  })
})
