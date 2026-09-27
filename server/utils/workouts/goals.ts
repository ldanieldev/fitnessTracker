import { and, eq } from 'drizzle-orm'
import type { GraphMetric, WorkoutGoal } from '~~/shared/types/workout'
import { metricsFor } from '~~/shared/utils/workoutMetrics'
import { exercises, workoutExerciseGoals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadExerciseForUser } from '~~/server/utils/workouts/exercises'
import type { WorkoutGoalInput } from '~~/server/utils/workouts/input'
import { stampGoals } from '~~/server/utils/workouts/rollups'

type GoalRow = typeof workoutExerciseGoals.$inferSelect

function toGoal(row: GoalRow): WorkoutGoal {
  return {
    exerciseId: row.exerciseId,
    metric: row.metric as GraphMetric,
    targetValue: Number(row.targetValue),
    targetReps: row.targetReps,
    targetDate: row.targetDate,
    achievedAt: row.achievedAt ? row.achievedAt.toISOString() : null
  }
}

export async function loadWorkoutGoal(
  userId: number,
  exerciseId: number,
  metric: GraphMetric
): Promise<WorkoutGoal | null> {
  const row = await db
    .select()
    .from(workoutExerciseGoals)
    .where(and(
      eq(workoutExerciseGoals.userId, userId),
      eq(workoutExerciseGoals.exerciseId, exerciseId),
      eq(workoutExerciseGoals.metric, metric)
    ))
    .then((r) => r[0])
  return row ? toGoal(row) : null
}

export async function loadWorkoutGoals(userId: number): Promise<Array<WorkoutGoal & { exerciseName: string }>> {
  const rows = await db
    .select({ goal: workoutExerciseGoals, exerciseName: exercises.name })
    .from(workoutExerciseGoals)
    .innerJoin(exercises, eq(exercises.id, workoutExerciseGoals.exerciseId))
    .where(eq(workoutExerciseGoals.userId, userId))
    .orderBy(exercises.name)
  return rows.map(({ goal, exerciseName }) => ({ ...toGoal(goal), exerciseName }))
}

export async function putGoal(userId: number, exerciseId: number, input: WorkoutGoalInput): Promise<WorkoutGoal> {
  const exercise = await loadExerciseForUser(userId, exerciseId)
  if (!metricsFor(exercise.trackingType, exercise.loadStyle).includes(input.metric)) {
    throw createError({ statusCode: 400, statusMessage: 'That metric does not apply to this exercise' })
  }
  if (input.metric === 'weight_at_reps' && input.targetReps == null) {
    throw createError({ statusCode: 400, statusMessage: 'A weight-at-reps goal needs a rep count' })
  }

  const values = {
    targetValue: String(input.targetValue),
    targetReps: input.metric === 'weight_at_reps' ? input.targetReps ?? null : null,
    targetDate: input.targetDate ?? null,
    achievedAt: null
  }
  await db
    .insert(workoutExerciseGoals)
    .values({ userId, exerciseId, metric: input.metric, ...values })
    .onConflictDoUpdate({
      target: [workoutExerciseGoals.userId, workoutExerciseGoals.exerciseId, workoutExerciseGoals.metric],
      set: values
    })
  // A new target may already be met by history, so stamp before returning rather than waiting for the next set.
  await stampGoals(userId, exerciseId)
  return (await loadWorkoutGoal(userId, exerciseId, input.metric))!
}

export async function removeGoal(userId: number, exerciseId: number, metric: GraphMetric): Promise<void> {
  await db
    .delete(workoutExerciseGoals)
    .where(and(
      eq(workoutExerciseGoals.userId, userId),
      eq(workoutExerciseGoals.exerciseId, exerciseId),
      eq(workoutExerciseGoals.metric, metric)
    ))
}
