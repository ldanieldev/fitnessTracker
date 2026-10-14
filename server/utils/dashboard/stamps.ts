import { and, between, count, eq, sql } from 'drizzle-orm'
import type { DateRange } from '~~/shared/types/dashboard'
import {
  diaryDays,
  diaryEntries,
  measurementGoals,
  measurements,
  workoutEntries,
  workoutExerciseGoals,
  workoutExerciseRollups,
  workoutSessions,
  workoutSets
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

// Raw column names: Drizzle strips table qualification inside select-field fragments, and every table has updated_at.
const maxUpdated = (table: string) => sql<string | null>`extract(epoch from max(${sql.raw(table)}.updated_at))::text`

export function workoutsStamp(userId: number, window: DateRange) {
  return db
    .select({
      sessions: sql<number>`count(distinct workout_sessions.id)`.mapWith(Number),
      ended: sql<number>`count(distinct workout_sessions.id) filter (where workout_sessions.ended_at is not null)`
        .mapWith(Number),
      entries: sql<number>`count(distinct workout_entries.id)`.mapWith(Number),
      sets: count(workoutSets.id),
      sessionsAt: maxUpdated('workout_sessions'),
      entriesAt: maxUpdated('workout_entries'),
      setsAt: maxUpdated('workout_sets')
    })
    .from(workoutSessions)
    .leftJoin(workoutEntries, eq(workoutEntries.sessionId, workoutSessions.id))
    .leftJoin(workoutSets, eq(workoutSets.entryId, workoutEntries.id))
    .where(and(eq(workoutSessions.userId, userId), between(workoutSessions.performedOn, window.from, window.to)))
}

// Rollups land after their sets commit (imports rebuild them at the end), so set stamps alone can cache them missing.
export function rollupsStamp(userId: number, window: DateRange) {
  return db
    .select({
      rows: count(),
      sets: sql<string | null>`sum(workout_exercise_rollups.set_count)::text`,
      volume: sql<string | null>`sum(workout_exercise_rollups.total_volume)::text`,
      e1rm: sql<string | null>`sum(workout_exercise_rollups.best_e1rm)::text`
    })
    .from(workoutExerciseRollups)
    .where(
      and(
        eq(workoutExerciseRollups.userId, userId),
        between(workoutExerciseRollups.performedOn, window.from, window.to)
      )
    )
}

export function bodyweightStamp(userId: number, typeId: number) {
  return Promise.all([
    db
      .select({ rows: count(), at: maxUpdated('measurements') })
      .from(measurements)
      .where(and(eq(measurements.userId, userId), eq(measurements.typeId, typeId))),
    db
      .select({
        target: measurementGoals.targetValue,
        start: measurementGoals.startValue,
        at: maxUpdated('measurement_goals')
      })
      .from(measurementGoals)
      .where(and(eq(measurementGoals.userId, userId), eq(measurementGoals.typeId, typeId)))
      .groupBy(measurementGoals.targetValue, measurementGoals.startValue)
  ])
}

export function nutritionStamp(userId: number) {
  return db
    .select({ rows: count(diaryEntries.id), at: maxUpdated('diary_entries') })
    .from(diaryEntries)
    .innerJoin(diaryDays, eq(diaryDays.id, diaryEntries.dayId))
    .where(eq(diaryDays.userId, userId))
}

export function consistencyStamp(userId: number) {
  return db
    .select({
      sessions: count(),
      finished: count(workoutSessions.endedAt),
      at: maxUpdated('workout_sessions')
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
}

export function goalsStamp(userId: number) {
  return db
    .select({
      rows: count(),
      goals: sql<string | null>`string_agg(
        workout_exercise_goals.exercise_id || ':' || workout_exercise_goals.metric || ':' ||
        workout_exercise_goals.target_value || ':' || coalesce(workout_exercise_goals.target_reps::text, '') || ':' ||
        coalesce(workout_exercise_goals.target_date::text, '') || ':' ||
        coalesce(workout_exercise_goals.achieved_at::text, ''),
        ',' order by workout_exercise_goals.exercise_id, workout_exercise_goals.metric)`
    })
    .from(workoutExerciseGoals)
    .where(eq(workoutExerciseGoals.userId, userId))
}
