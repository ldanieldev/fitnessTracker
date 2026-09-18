import { and, desc, eq, lt, or } from 'drizzle-orm'
import type { SetMeasures } from '~~/shared/types/workout'
import type { HistorySet } from '~~/shared/utils/workoutRecords'
import { workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export interface OrderedHistorySet extends HistorySet {
  sessionId: number
}

export async function historyForExercise(userId: number, exerciseId: number): Promise<OrderedHistorySet[]> {
  const rows = await db
    .select({
      id: workoutSets.id,
      sessionId: workoutEntries.sessionId,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(and(eq(workoutSessions.userId, userId), eq(workoutEntries.exerciseId, exerciseId)))
    .orderBy(workoutSessions.performedOn, workoutSessions.startedAt, workoutSessions.id, workoutSets.id)

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    weight: row.weight != null ? Number(row.weight) : null,
    reps: row.reps,
    distanceMeters: row.distanceMeters != null ? Number(row.distanceMeters) : null,
    durationSeconds: row.durationSeconds
  }))
}

async function priorSessionId(userId: number, exerciseId: number, sessionId: number): Promise<number | undefined> {
  const current = await db
    .select({ performedOn: workoutSessions.performedOn, startedAt: workoutSessions.startedAt })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
    .then((r) => r[0])
  if (!current) return undefined

  const earlier = or(
    lt(workoutSessions.performedOn, current.performedOn),
    and(eq(workoutSessions.performedOn, current.performedOn), lt(workoutSessions.startedAt, current.startedAt)),
    and(
      eq(workoutSessions.performedOn, current.performedOn),
      eq(workoutSessions.startedAt, current.startedAt),
      lt(workoutSessions.id, sessionId)
    )
  )

  const row = await db
    .selectDistinct({
      id: workoutSessions.id,
      performedOn: workoutSessions.performedOn,
      startedAt: workoutSessions.startedAt
    })
    .from(workoutSessions)
    .innerJoin(workoutEntries, eq(workoutEntries.sessionId, workoutSessions.id))
    .innerJoin(workoutSets, eq(workoutSets.entryId, workoutEntries.id))
    .where(and(eq(workoutSessions.userId, userId), eq(workoutEntries.exerciseId, exerciseId), earlier))
    .orderBy(desc(workoutSessions.performedOn), desc(workoutSessions.startedAt), desc(workoutSessions.id))
    .limit(1)
    .then((r) => r[0])

  return row?.id
}

export async function lastSetsForExercise(
  userId: number,
  exerciseId: number,
  sessionId: number
): Promise<SetMeasures[]> {
  const priorId = await priorSessionId(userId, exerciseId, sessionId)
  if (priorId === undefined) return []

  const rows = await db
    .select({
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .where(and(eq(workoutEntries.sessionId, priorId), eq(workoutEntries.exerciseId, exerciseId)))
    .orderBy(workoutSets.sortOrder, workoutSets.id)

  return rows.map(({ weight, reps, distanceMeters, durationSeconds }) => {
    const measures: SetMeasures = {}
    if (weight != null) measures.weight = Number(weight)
    if (reps != null) measures.reps = reps
    if (distanceMeters != null) measures.distanceMeters = Number(distanceMeters)
    if (durationSeconds != null) measures.durationSeconds = durationSeconds
    return measures
  })
}
