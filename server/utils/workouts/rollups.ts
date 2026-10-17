import { and, asc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { union } from 'drizzle-orm/pg-core'
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
import { db, type DbClient } from '~~/server/utils/db'

const num = (value: string | null) => (value != null ? Number(value) : null)

export async function repCapFor(userId: number, client: DbClient = db): Promise<number> {
  const row = await client
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

async function contextFor(client: DbClient, sessionId: number, exerciseId: number): Promise<RollupContext | null> {
  const session = await client
    .select({ performedOn: workoutSessions.performedOn })
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .then((r) => r[0])
  if (!session) return null

  const rows = await client
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

async function writeRollup(client: DbClient, userId: number, sessionId: number, exerciseId: number): Promise<void> {
  const context = await contextFor(client, sessionId, exerciseId)
  const where = and(eq(workoutExerciseRollups.sessionId, sessionId), eq(workoutExerciseRollups.exerciseId, exerciseId))
  if (!context) {
    await client.delete(workoutExerciseRollups).where(where)
    return
  }
  const values = rollupFrom(context.sets, context.loadStyle, await repCapFor(userId, client))
  await upsertRollups(client, [toRow(userId, sessionId, exerciseId, context, values)])
}

const UPDATED_ON_CONFLICT = Object.fromEntries(
  Object.entries(getTableColumns(workoutExerciseRollups))
    .filter(([key]) => key !== 'sessionId' && key !== 'exerciseId')
    .map(([key, column]) => [key, sql.raw(`excluded.${column.name}`)])
)

async function upsertRollups(client: DbClient, rows: ReturnType<typeof toRow>[]): Promise<void> {
  if (!rows.length) return
  await client
    .insert(workoutExerciseRollups)
    .values(rows)
    .onConflictDoUpdate({
      target: [workoutExerciseRollups.sessionId, workoutExerciseRollups.exerciseId],
      set: UPDATED_ON_CONFLICT
    })
}

export async function refreshRollup(
  userId: number,
  sessionId: number,
  exerciseId: number,
  client: DbClient = db
): Promise<void> {
  await writeRollup(client, userId, sessionId, exerciseId)
  await stampGoals(userId, exerciseId, client)
}

export async function refreshSessionDate(sessionId: number, performedOn: string, client: DbClient = db) {
  await client
    .update(workoutExerciseRollups)
    .set({ performedOn })
    .where(eq(workoutExerciseRollups.sessionId, sessionId))
}

export async function stampGoals(userId: number, exerciseId: number, client: DbClient = db): Promise<void> {
  const goals = await client
    .select()
    .from(workoutExerciseGoals)
    .where(and(eq(workoutExerciseGoals.userId, userId), eq(workoutExerciseGoals.exerciseId, exerciseId)))
  if (goals.length === 0) return

  const rows = await client
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
    await client
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

// Sessions per transaction: bounds every query's bind parameters and how long a live set write waits on the locks.
export const REBUILD_CHUNK = 200
// Rows per upsert: 500 × 17 columns stays far below Postgres's 65,535 bind-parameter limit.
const UPSERT_BATCH = 500

async function rebuildChunk(tx: DbClient, userId: number, repCap: number, sessionIds: number[]): Promise<number> {
  // Session rows first, as live set writes lock them, so no set lands between this read and the upsert or prune.
  await tx
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), inArray(workoutSessions.id, sessionIds)))
    .orderBy(asc(workoutSessions.id))
    .for('no key update')
  const sets = await tx
    .select({
      sessionId: workoutEntries.sessionId,
      exerciseId: workoutEntries.exerciseId,
      performedOn: workoutSessions.performedOn,
      trackingType: workoutEntries.trackingType,
      loadStyle: workoutEntries.loadStyle,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(inArray(workoutEntries.sessionId, sessionIds))
    .orderBy(
      workoutEntries.sessionId,
      workoutEntries.exerciseId,
      workoutEntries.sortOrder,
      workoutSets.sortOrder,
      workoutSets.id
    )

  const contexts = new Map<string, RollupContext & { sessionId: number; exerciseId: number }>()
  for (const set of sets) {
    const key = `${set.sessionId}:${set.exerciseId}`
    let context = contexts.get(key)
    if (!context) {
      context = { ...set, sets: [] }
      contexts.set(key, context)
    }
    context.sets.push({
      weight: num(set.weight),
      reps: set.reps,
      distanceMeters: num(set.distanceMeters),
      durationSeconds: set.durationSeconds
    })
  }
  const rows = [...contexts.values()].map((context) =>
    toRow(
      userId,
      context.sessionId,
      context.exerciseId,
      context,
      rollupFrom(context.sets, context.loadStyle, repCap)
    )
  )
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) await upsertRollups(tx, rows.slice(i, i + UPSERT_BATCH))

  await tx.delete(workoutExerciseRollups).where(
    and(
      inArray(workoutExerciseRollups.sessionId, sessionIds),
      sql`not exists (
        select 1 from ${workoutSets}
        inner join ${workoutEntries} on ${workoutEntries.id} = ${workoutSets.entryId}
        where ${workoutEntries.sessionId} = ${workoutExerciseRollups.sessionId}
          and ${workoutEntries.exerciseId} = ${workoutExerciseRollups.exerciseId}
      )`
    )
  )
  return rows.length
}

export async function rebuildUserRollups(userId: number): Promise<{ rows: number }> {
  const repCap = await repCapFor(userId)
  const sessionIds = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(asc(workoutSessions.id))
    .then((r) => r.map((row) => row.id))

  let rows = 0
  for (let i = 0; i < sessionIds.length; i += REBUILD_CHUNK) {
    const chunk = sessionIds.slice(i, i + REBUILD_CHUNK)
    rows += await db.transaction((tx) => rebuildChunk(tx, userId, repCap, chunk))
  }

  const goals = await db
    .selectDistinct({ exerciseId: workoutExerciseGoals.exerciseId })
    .from(workoutExerciseGoals)
    .where(eq(workoutExerciseGoals.userId, userId))
  // Stamped after the prune so a goal whose earning rows were just removed loses its Reached stamp.
  for (const goal of goals) await stampGoals(userId, goal.exerciseId)
  return { rows }
}

// Rollups cascade with their sessions and stamps live on goals, so a user with neither has nothing to rebuild.
export async function rollupUserIds(): Promise<number[]> {
  const sessionUsers = db.selectDistinct({ id: workoutSessions.userId }).from(workoutSessions)
  const goalUsers = db.selectDistinct({ id: workoutExerciseGoals.userId }).from(workoutExerciseGoals)
  const rows = await union(sessionUsers, goalUsers)
  return rows.map((row) => row.id).sort((a, b) => a - b)
}

export async function rebuildRollups(userId?: number): Promise<{ rows: number }> {
  if (userId !== undefined) return rebuildUserRollups(userId)
  let rows = 0
  for (const id of await rollupUserIds()) rows += (await rebuildUserRollups(id)).rows
  return { rows }
}
