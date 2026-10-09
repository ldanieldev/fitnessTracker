import { and, desc, eq, inArray, lt, or } from 'drizzle-orm'
import type { SetMeasures } from '~~/shared/types/workout'
import type { HistorySet } from '~~/shared/utils/workoutRecords'
import { workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export interface OrderedHistorySet extends HistorySet {
  sessionId: number
}

export interface SessionAnchor {
  id: number
  performedOn: string
  startedAt: Date
}

export function withNumericMeasures<T extends { weight: string | null, distanceMeters: string | null }>(
  row: T
): Omit<T, 'weight' | 'distanceMeters'> & { weight: number | null, distanceMeters: number | null } {
  return {
    ...row,
    weight: row.weight != null ? Number(row.weight) : null,
    distanceMeters: row.distanceMeters != null ? Number(row.distanceMeters) : null
  }
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

  return rows.map(withNumericMeasures)
}

function earlierThan(anchor: SessionAnchor) {
  return or(
    lt(workoutSessions.performedOn, anchor.performedOn),
    and(eq(workoutSessions.performedOn, anchor.performedOn), lt(workoutSessions.startedAt, anchor.startedAt)),
    and(
      eq(workoutSessions.performedOn, anchor.performedOn),
      eq(workoutSessions.startedAt, anchor.startedAt),
      lt(workoutSessions.id, anchor.id)
    )
  )
}

// Records compare values only, so one row per distinct measure combination stands in for every earlier set.
export async function earlierSetValues(
  userId: number,
  anchor: SessionAnchor,
  exerciseIds: number[]
): Promise<Map<number, HistorySet[]>> {
  const byExercise = new Map<number, HistorySet[]>()
  if (!exerciseIds.length) return byExercise
  const rows = await db
    .selectDistinct({
      exerciseId: workoutEntries.exerciseId,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(and(eq(workoutSessions.userId, userId), inArray(workoutEntries.exerciseId, exerciseIds), earlierThan(anchor)))

  rows.forEach(({ exerciseId, ...measures }, index) => {
    const list = byExercise.get(exerciseId) ?? []
    // Negative ids never collide with a real set id, which recordsForEarlier looks up.
    list.push({ id: -(index + 1), ...withNumericMeasures(measures) })
    byExercise.set(exerciseId, list)
  })
  return byExercise
}

export async function lastSetsByExercise(
  userId: number,
  anchor: SessionAnchor,
  exerciseIds: number[]
): Promise<Map<number, SetMeasures[]>> {
  const byExercise = new Map<number, SetMeasures[]>()
  if (!exerciseIds.length) return byExercise
  const prior = await db
    .selectDistinctOn([workoutEntries.exerciseId], { exerciseId: workoutEntries.exerciseId, sessionId: workoutSessions.id })
    .from(workoutSessions)
    .innerJoin(workoutEntries, eq(workoutEntries.sessionId, workoutSessions.id))
    .innerJoin(workoutSets, eq(workoutSets.entryId, workoutEntries.id))
    .where(and(eq(workoutSessions.userId, userId), inArray(workoutEntries.exerciseId, exerciseIds), earlierThan(anchor)))
    .orderBy(workoutEntries.exerciseId, desc(workoutSessions.performedOn), desc(workoutSessions.startedAt), desc(workoutSessions.id))
  if (!prior.length) return byExercise

  const rows = await db
    .select({
      exerciseId: workoutEntries.exerciseId,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .where(or(...prior.map((p) => and(eq(workoutEntries.sessionId, p.sessionId), eq(workoutEntries.exerciseId, p.exerciseId)))))
    .orderBy(workoutSets.sortOrder, workoutSets.id)

  for (const row of rows) {
    const { weight, reps, distanceMeters, durationSeconds } = withNumericMeasures(row)
    const measures: SetMeasures = {}
    if (weight != null) measures.weight = weight
    if (reps != null) measures.reps = reps
    if (distanceMeters != null) measures.distanceMeters = distanceMeters
    if (durationSeconds != null) measures.durationSeconds = durationSeconds
    byExercise.set(row.exerciseId, [...(byExercise.get(row.exerciseId) ?? []), measures])
  }
  return byExercise
}
