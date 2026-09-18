import { and, eq } from 'drizzle-orm'
import type { SetMeasures, WorkoutSession, WorkoutSet } from '~~/shared/types/workout'
import { validateSetInput } from '~~/shared/utils/setRules'
import { workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { SetWriteInput } from '~~/server/utils/workouts/input'
import { loadOwnedEntry } from '~~/server/utils/workouts/entries'
import { loadSession } from '~~/server/utils/workouts/sessions'
import { siblingIds, renumberSiblings } from '~~/server/utils/workouts/sortOrder'

const SET_NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Set not found' } as const

async function loadOwnedSet(userId: number, setId: number) {
  const row = await db
    .select({
      id: workoutSets.id,
      entryId: workoutSets.entryId,
      sessionId: workoutEntries.sessionId,
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
    .where(and(eq(workoutSets.id, setId), eq(workoutSessions.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(SET_NOT_FOUND_ERROR)
  return row
}

async function setSiblingIds(tx: DbClient, entryId: number): Promise<number[]> {
  return siblingIds(tx, workoutSets, workoutSets.id, workoutSets.sortOrder, workoutSets.entryId, entryId)
}

function extractSet(session: WorkoutSession, entryId: number, setId: number): WorkoutSet {
  const entry = session.entries.find((e) => e.id === entryId)
  const set = entry?.sets.find((s) => s.id === setId)
  if (!set) throw createError(SET_NOT_FOUND_ERROR)
  return set
}

export async function addSet(
  userId: number,
  entryId: number,
  input: SetWriteInput
): Promise<{ session: WorkoutSession, set: WorkoutSet }> {
  const entry = await loadOwnedEntry(userId, entryId)
  const measures: SetMeasures = {
    weight: input.weight ?? null,
    reps: input.reps ?? null,
    distanceMeters: input.distanceMeters ?? null,
    durationSeconds: input.durationSeconds ?? null
  }
  const message = validateSetInput(entry.trackingType, measures)
  if (message) throw createError({ statusCode: 400, statusMessage: message })

  const sortOrder = (await setSiblingIds(db, entryId)).length
  const row = await db
    .insert(workoutSets)
    .values({
      entryId,
      sortOrder,
      weight: measures.weight != null ? String(measures.weight) : null,
      reps: measures.reps,
      distanceMeters: measures.distanceMeters != null ? String(measures.distanceMeters) : null,
      durationSeconds: measures.durationSeconds,
      done: input.done ?? false,
      comment: input.comment ?? null
    })
    .returning()
    .then((r) => r[0]!)

  const session = await loadSession(userId, entry.sessionId)
  return { session, set: extractSet(session, entryId, row.id) }
}

export async function patchSet(
  userId: number,
  setId: number,
  patch: SetWriteInput
): Promise<{ session: WorkoutSession, set: WorkoutSet }> {
  const existing = await loadOwnedSet(userId, setId)
  const measures: SetMeasures = {
    weight: patch.weight !== undefined ? patch.weight : existing.weight != null ? Number(existing.weight) : null,
    reps: patch.reps !== undefined ? patch.reps : existing.reps,
    distanceMeters: patch.distanceMeters !== undefined
      ? patch.distanceMeters
      : existing.distanceMeters != null ? Number(existing.distanceMeters) : null,
    durationSeconds: patch.durationSeconds !== undefined ? patch.durationSeconds : existing.durationSeconds
  }
  const message = validateSetInput(existing.trackingType, measures)
  if (message) throw createError({ statusCode: 400, statusMessage: message })

  // Write only what the patch carries: a done/comment patch must not re-write measures a concurrent save just changed.
  const values: Partial<typeof workoutSets.$inferInsert> = {}
  if (patch.weight !== undefined) values.weight = measures.weight != null ? String(measures.weight) : null
  if (patch.reps !== undefined) values.reps = measures.reps
  if (patch.distanceMeters !== undefined) {
    values.distanceMeters = measures.distanceMeters != null ? String(measures.distanceMeters) : null
  }
  if (patch.durationSeconds !== undefined) values.durationSeconds = measures.durationSeconds
  if (patch.done !== undefined) values.done = patch.done
  if (patch.comment !== undefined) values.comment = patch.comment

  if (Object.keys(values).length > 0) await db.update(workoutSets).set(values).where(eq(workoutSets.id, setId))

  const session = await loadSession(userId, existing.sessionId)
  return { session, set: extractSet(session, existing.entryId, setId) }
}

export async function deleteSet(userId: number, setId: number): Promise<WorkoutSession> {
  const existing = await loadOwnedSet(userId, setId)
  await db.transaction(async (tx) => {
    await tx.delete(workoutSets).where(eq(workoutSets.id, setId))
    const ids = await setSiblingIds(tx, existing.entryId)
    await renumberSiblings(tx, workoutSets, workoutSets.id, workoutSets.sortOrder, ids)
  })
  return loadSession(userId, existing.sessionId)
}
