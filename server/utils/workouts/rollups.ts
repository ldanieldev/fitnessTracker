import { and, eq, sql } from 'drizzle-orm'
import type { GraphMetric, LoadStyle, TrackingType } from '~~/shared/types/workout'
import {
  latestLoadStyle,
  metricLowerIsBetter,
  metricValue,
  rollupFrom,
  type RollupSet,
  type RollupValues
} from '~~/shared/utils/workoutMetrics'
import {
  users,
  workoutEntries,
  workoutExerciseGoals,
  workoutExerciseRollups,
  workoutSessions,
  workoutSets
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

const num = (value: string | null) => (value != null ? Number(value) : null)

export async function repCapFor(userId: number): Promise<number> {
  const row = await db
    .select({ cap: users.oneRepMaxRepCap })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0])
  return row?.cap ?? 10
}

export function toRollupValues(row: typeof workoutExerciseRollups.$inferSelect): RollupValues {
  return {
    setCount: row.setCount,
    totalReps: row.totalReps,
    totalVolume: num(row.totalVolume),
    topWeight: num(row.topWeight),
    topWeightReps: row.topWeightReps,
    topSetVolume: num(row.topSetVolume),
    bestE1rm: num(row.bestE1rm),
    weightByReps: row.weightByReps,
    totalDistanceMeters: num(row.totalDistanceMeters),
    totalDurationSeconds: row.totalDurationSeconds,
    bestPace: num(row.bestPace)
  }
}

interface RollupContext {
  performedOn: string
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  sets: RollupSet[]
}

async function contextFor(sessionId: number, exerciseId: number): Promise<RollupContext | null> {
  const session = await db
    .select({ performedOn: workoutSessions.performedOn })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .then((r) => r[0])
  if (!session) return null

  const rows = await db
    .select({
      trackingType: workoutEntries.trackingType,
      loadStyle: workoutEntries.loadStyle,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .where(and(eq(workoutEntries.sessionId, sessionId), eq(workoutEntries.exerciseId, exerciseId)))
    .orderBy(workoutEntries.sortOrder, workoutSets.sortOrder, workoutSets.id)
  if (rows.length === 0) return null

  return {
    performedOn: session.performedOn,
    trackingType: rows[0]!.trackingType,
    loadStyle: rows[0]!.loadStyle,
    sets: rows.map((row) => ({
      weight: num(row.weight),
      reps: row.reps,
      distanceMeters: num(row.distanceMeters),
      durationSeconds: row.durationSeconds
    }))
  }
}

function toRow(userId: number, sessionId: number, exerciseId: number, context: RollupContext, values: RollupValues) {
  return {
    sessionId,
    exerciseId,
    userId,
    performedOn: context.performedOn,
    trackingType: context.trackingType,
    loadStyle: context.loadStyle,
    setCount: values.setCount,
    totalReps: values.totalReps,
    totalVolume: values.totalVolume != null ? String(values.totalVolume) : null,
    topWeight: values.topWeight != null ? String(values.topWeight) : null,
    topWeightReps: values.topWeightReps,
    topSetVolume: values.topSetVolume != null ? String(values.topSetVolume) : null,
    bestE1rm: values.bestE1rm != null ? String(values.bestE1rm) : null,
    weightByReps: values.weightByReps,
    totalDistanceMeters: values.totalDistanceMeters != null ? String(values.totalDistanceMeters) : null,
    totalDurationSeconds: values.totalDurationSeconds,
    bestPace: values.bestPace != null ? String(values.bestPace) : null
  }
}

async function writeRollup(userId: number, sessionId: number, exerciseId: number): Promise<void> {
  const context = await contextFor(sessionId, exerciseId)
  const where = and(eq(workoutExerciseRollups.sessionId, sessionId), eq(workoutExerciseRollups.exerciseId, exerciseId))
  if (!context) {
    await db.delete(workoutExerciseRollups).where(where)
    return
  }
  const values = rollupFrom(context.sets, context.loadStyle, await repCapFor(userId))
  const row = toRow(userId, sessionId, exerciseId, context, values)
  const { sessionId: _s, exerciseId: _e, ...update } = row
  await db
    .insert(workoutExerciseRollups)
    .values(row)
    .onConflictDoUpdate({
      target: [workoutExerciseRollups.sessionId, workoutExerciseRollups.exerciseId],
      set: update
    })
}

export async function refreshRollup(userId: number, sessionId: number, exerciseId: number): Promise<void> {
  await writeRollup(userId, sessionId, exerciseId)
  await stampGoals(userId, exerciseId)
}

export async function refreshSessionDate(sessionId: number, performedOn: string): Promise<void> {
  await db.update(workoutExerciseRollups).set({ performedOn }).where(eq(workoutExerciseRollups.sessionId, sessionId))
}

export async function stampGoals(userId: number, exerciseId: number): Promise<void> {
  const goals = await db
    .select()
    .from(workoutExerciseGoals)
    .where(and(eq(workoutExerciseGoals.userId, userId), eq(workoutExerciseGoals.exerciseId, exerciseId)))
  if (goals.length === 0) return

  const rows = await db
    .select()
    .from(workoutExerciseRollups)
    .where(and(eq(workoutExerciseRollups.userId, userId), eq(workoutExerciseRollups.exerciseId, exerciseId)))
  const values = rows.map(toRollupValues)
  const loadStyle = latestLoadStyle(rows)

  for (const goal of goals) {
    const target = Number(goal.targetValue)
    const reached = values.some((row) => {
      const value = metricValue(row, goal.metric as GraphMetric, goal.targetReps)
      if (value == null) return false
      return metricLowerIsBetter(goal.metric as GraphMetric, loadStyle) ? value <= target : value >= target
    })
    if (reached === (goal.achievedAt != null)) continue
    await db
      .update(workoutExerciseGoals)
      .set({ achievedAt: reached ? new Date() : null })
      .where(
        and(
          eq(workoutExerciseGoals.userId, userId),
          eq(workoutExerciseGoals.exerciseId, exerciseId),
          eq(workoutExerciseGoals.metric, goal.metric)
        )
      )
  }
}

export async function rebuildRollups(userId?: number): Promise<{ rows: number }> {
  const pairs = await db
    .selectDistinct({
      userId: workoutSessions.userId,
      sessionId: workoutEntries.sessionId,
      exerciseId: workoutEntries.exerciseId
    })
    .from(workoutEntries)
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .innerJoin(workoutSets, eq(workoutSets.entryId, workoutEntries.id))
    .where(userId === undefined ? undefined : eq(workoutSessions.userId, userId))

  // Refresh before deleting so a crash mid-loop leaves stale rows rather than an empty table.
  for (const pair of pairs) await writeRollup(pair.userId, pair.sessionId, pair.exerciseId)

  const scope = userId === undefined ? undefined : eq(workoutExerciseRollups.userId, userId)
  if (pairs.length === 0) {
    await db.delete(workoutExerciseRollups).where(scope)
  } else {
    const keys = pairs.map((pair) => sql`(${pair.sessionId}, ${pair.exerciseId})`)
    await db
      .delete(workoutExerciseRollups)
      .where(
        and(
          scope,
          sql`(${workoutExerciseRollups.sessionId}, ${workoutExerciseRollups.exerciseId}) not in (${sql.join(keys, sql`, `)})`
        )
      )
  }

  const goalPairs = await db
    .selectDistinct({ userId: workoutExerciseGoals.userId, exerciseId: workoutExerciseGoals.exerciseId })
    .from(workoutExerciseGoals)
    .where(userId === undefined ? undefined : eq(workoutExerciseGoals.userId, userId))
  // Stamped after the prune so a goal whose earning rows were just removed loses its Reached stamp.
  for (const goal of goalPairs) await stampGoals(goal.userId, goal.exerciseId)
  return { rows: pairs.length }
}
