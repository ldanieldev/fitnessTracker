import { and, eq } from 'drizzle-orm'
import type { WorkoutEntry, WorkoutSession, WorkoutSet } from '~~/shared/types/workout'
import { exercisePrefs, exercises, workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { WorkoutEntryPatchInput } from '~~/server/utils/workouts/input'
import { loadExerciseForUser } from '~~/server/utils/workouts/exercises'
import { loadSession } from '~~/server/utils/workouts/sessions'
import { historyForExercise, lastSetsForExercise } from '~~/server/utils/workouts/history'
import { recordsForEarlier } from '~~/shared/utils/workoutRecords'
import { siblingIds, renumberSiblings } from '~~/server/utils/workouts/sortOrder'

const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Entry not found' } as const

async function loadSetRows(entryId: number): Promise<WorkoutSet[]> {
  const rows = await db
    .select({
      id: workoutSets.id,
      sortOrder: workoutSets.sortOrder,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds,
      done: workoutSets.done,
      comment: workoutSets.comment
    })
    .from(workoutSets)
    .where(eq(workoutSets.entryId, entryId))
    .orderBy(workoutSets.sortOrder, workoutSets.id)

  return rows.map((row) => ({
    id: row.id,
    sortOrder: row.sortOrder,
    weight: row.weight != null ? Number(row.weight) : null,
    reps: row.reps,
    distanceMeters: row.distanceMeters != null ? Number(row.distanceMeters) : null,
    durationSeconds: row.durationSeconds,
    done: row.done,
    comment: row.comment,
    records: []
  }))
}

export async function loadEntries(userId: number, sessionId: number): Promise<WorkoutEntry[]> {
  const rows = await db
    .select({
      id: workoutEntries.id,
      exerciseId: workoutEntries.exerciseId,
      exerciseName: exercises.name,
      sortOrder: workoutEntries.sortOrder,
      trackingType: workoutEntries.trackingType,
      loadStyle: workoutEntries.loadStyle,
      notes: workoutEntries.notes,
      exerciseBarWeight: exercises.barWeight,
      prefBarWeight: exercisePrefs.barWeight,
      weightIncrement: exercisePrefs.weightIncrement
    })
    .from(workoutEntries)
    .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
    .leftJoin(exercisePrefs, and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, workoutEntries.exerciseId)))
    .where(eq(workoutEntries.sessionId, sessionId))
    .orderBy(workoutEntries.sortOrder, workoutEntries.id)

  return Promise.all(rows.map(async (row) => {
    const barWeightRaw = row.prefBarWeight ?? row.exerciseBarWeight
    const [setRows, history, lastSets] = await Promise.all([
      loadSetRows(row.id),
      historyForExercise(userId, row.exerciseId),
      lastSetsForExercise(userId, row.exerciseId, sessionId)
    ])
    const sets = setRows.map((set) => ({
      ...set,
      records: recordsForEarlier(history, set.id, row.trackingType, row.loadStyle)
    }))
    return {
      id: row.id,
      exerciseId: row.exerciseId,
      exerciseName: row.exerciseName,
      sortOrder: row.sortOrder,
      trackingType: row.trackingType,
      loadStyle: row.loadStyle,
      barWeight: row.loadStyle === 'barbell' && barWeightRaw != null ? Number(barWeightRaw) : null,
      weightIncrement: row.weightIncrement != null ? Number(row.weightIncrement) : null,
      notes: row.notes,
      sets,
      lastSets
    }
  }))
}

export async function addEntry(userId: number, sessionId: number, exerciseId: number): Promise<WorkoutSession> {
  const session = await loadSession(userId, sessionId)
  const exercise = await loadExerciseForUser(userId, exerciseId)
  await db.insert(workoutEntries).values({
    sessionId,
    exerciseId,
    sortOrder: session.entries.length,
    trackingType: exercise.trackingType,
    loadStyle: exercise.loadStyle
  })
  return loadSession(userId, sessionId)
}

export async function loadOwnedEntry(userId: number, entryId: number) {
  const row = await db
    .select({
      id: workoutEntries.id,
      sessionId: workoutEntries.sessionId,
      sortOrder: workoutEntries.sortOrder,
      exerciseId: workoutEntries.exerciseId,
      trackingType: workoutEntries.trackingType,
      loadStyle: workoutEntries.loadStyle
    })
    .from(workoutEntries)
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(and(eq(workoutEntries.id, entryId), eq(workoutSessions.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(NOT_FOUND_ERROR)
  return row
}

async function entrySiblingIds(tx: DbClient, sessionId: number): Promise<number[]> {
  return siblingIds(
    tx, workoutEntries, workoutEntries.id, workoutEntries.sortOrder, workoutEntries.sessionId, sessionId
  )
}

export async function patchEntry(userId: number, entryId: number, patch: WorkoutEntryPatchInput): Promise<WorkoutSession> {
  const entry = await loadOwnedEntry(userId, entryId)

  if (patch.notes !== undefined || patch.sortOrder !== undefined) {
    await db.transaction(async (tx) => {
      if (patch.notes !== undefined) {
        await tx.update(workoutEntries).set({ notes: patch.notes }).where(eq(workoutEntries.id, entryId))
      }
      if (patch.sortOrder !== undefined && patch.sortOrder !== entry.sortOrder) {
        const ids = (await entrySiblingIds(tx, entry.sessionId)).filter((id) => id !== entryId)
        const clamped = Math.min(Math.max(patch.sortOrder, 0), ids.length)
        ids.splice(clamped, 0, entryId)
        await renumberSiblings(tx, workoutEntries, workoutEntries.id, workoutEntries.sortOrder, ids)
      }
    })
  }

  return loadSession(userId, entry.sessionId)
}

export async function deleteEntry(userId: number, entryId: number): Promise<WorkoutSession> {
  const entry = await loadOwnedEntry(userId, entryId)
  await db.transaction(async (tx) => {
    await tx.delete(workoutEntries).where(eq(workoutEntries.id, entryId))
    const ids = await entrySiblingIds(tx, entry.sessionId)
    await renumberSiblings(tx, workoutEntries, workoutEntries.id, workoutEntries.sortOrder, ids)
  })
  return loadSession(userId, entry.sessionId)
}
