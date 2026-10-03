import { csvCell } from './csv'

export interface WorkoutCsvRow {
  date: string
  workout: string
  exercise: string
  category: string
  set: number
  weight: number | null
  reps: number | null
  distanceMeters: number | null
  durationSeconds: number | null
  superset: string | null
  comment: string | null
  workoutComment: string | null
}

export const WORKOUT_CSV_HEADER = [
  'Date', 'Workout', 'Exercise', 'Category', 'Set', 'Weight', 'Weight unit', 'Reps', 'Distance',
  'Distance unit', 'Duration (s)', 'Superset', 'Comment', 'Workout comment'
] as const

export function toWorkoutCsv(rows: WorkoutCsvRow[]): string {
  const lines = rows.map((row) => [
    row.date,
    row.workout,
    row.exercise,
    row.category,
    row.set,
    row.weight,
    row.weight === null ? null : 'lb',
    row.reps,
    row.distanceMeters,
    row.distanceMeters === null ? null : 'm',
    row.durationSeconds,
    row.superset,
    row.comment,
    row.workoutComment
  ].map(csvCell).join(','))
  return [WORKOUT_CSV_HEADER.join(','), ...lines].join('\n')
}
