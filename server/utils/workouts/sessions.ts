import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { WorkoutSession, WorkoutSessionSummary } from '~~/shared/types/workout'
import { workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import type { SessionPatchInput, SessionStartInput } from '~~/server/utils/workouts/input'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { addEntry, loadEntries } from '~~/server/utils/workouts/entries'
import { refreshSessionDate } from '~~/server/utils/workouts/rollups'

const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Workout not found' } as const

async function toSession(row: typeof workoutSessions.$inferSelect): Promise<WorkoutSession> {
  return {
    id: row.id,
    name: row.name,
    performedOn: row.performedOn,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    notes: row.notes,
    entries: await loadEntries(row.userId, row.id)
  }
}

async function openSessionRow(userId: number) {
  return db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), isNull(workoutSessions.endedAt)))
    .then((r) => r[0])
}

export async function activeSession(userId: number): Promise<WorkoutSession | null> {
  const row = await openSessionRow(userId)
  return row ? await toSession(row) : null
}

export async function startSession(userId: number, input: SessionStartInput): Promise<WorkoutSession> {
  const performedOn = input.performedOn ?? new Date().toISOString().slice(0, 10)
  // Load the source before inserting so a foreign/missing copyFromId 404s without leaving a new session behind.
  const source = input.copyFromId !== undefined ? await loadSession(userId, input.copyFromId) : null
  try {
    const row = await db
      .insert(workoutSessions)
      .values({ userId, name: input.name ?? null, performedOn })
      .returning()
      .then((r) => r[0]!)
    if (source) {
      for (const sourceEntry of source.entries) {
        try {
          await addEntry(userId, row.id, sourceEntry.exerciseId)
        } catch (err) {
          // LG-R9: a soft-deleted source exercise 404s from addEntry — skip it rather than failing the whole copy.
          if (!(err instanceof Error && 'statusCode' in err && err.statusCode === 404)) throw err
        }
      }
    }
    return loadSession(userId, row.id)
  } catch (err) {
    if (isUniqueViolation(err, 'workout_session_open')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A workout is already open',
        data: { session: await activeSession(userId) }
      })
    }
    throw err
  }
}

// Drizzle strips table qualification in a select-field sql fragment; bare id is ambiguous across commonColumns tables.
const exerciseCount = sql<number>`(
  select count(*) from ${workoutEntries} where ${workoutEntries.sessionId} = workout_sessions.id
)`.mapWith(Number)
const setCount = sql<number>`(
  select count(*) from ${workoutSets}
  inner join ${workoutEntries} on workout_entries.id = ${workoutSets.entryId}
  where ${workoutEntries.sessionId} = workout_sessions.id
)`.mapWith(Number)

export async function listSessions(userId: number, { limit }: { limit: number }): Promise<WorkoutSessionSummary[]> {
  const rows = await db
    .select({
      id: workoutSessions.id,
      name: workoutSessions.name,
      performedOn: workoutSessions.performedOn,
      startedAt: workoutSessions.startedAt,
      endedAt: workoutSessions.endedAt,
      exerciseCount,
      setCount
    })
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, userId))
    .orderBy(desc(workoutSessions.performedOn), desc(workoutSessions.startedAt), desc(workoutSessions.id))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    performedOn: row.performedOn,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    exerciseCount: row.exerciseCount,
    setCount: row.setCount
  }))
}

export async function loadSession(userId: number, id: number): Promise<WorkoutSession> {
  const row = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(NOT_FOUND_ERROR)
  return toSession(row)
}

export async function patchSession(userId: number, id: number, patch: SessionPatchInput): Promise<WorkoutSession> {
  const current = await loadSession(userId, id)

  const values: Partial<typeof workoutSessions.$inferInsert> = {}
  if (patch.name !== undefined) values.name = patch.name
  if (patch.notes !== undefined) values.notes = patch.notes
  // The server never derives performedOn from startedAt; the caller sends the day it means (LG-R23).
  if (patch.performedOn !== undefined) values.performedOn = patch.performedOn
  if (patch.startedAt !== undefined) values.startedAt = new Date(patch.startedAt)
  if (patch.endedAt !== undefined) values.endedAt = patch.endedAt ? new Date(patch.endedAt) : null
  if (patch.finish !== undefined) values.endedAt = patch.finish ? new Date() : null

  // checked against the written values, not the input, so a finish resolved to now validates against a patched start.
  if (values.startedAt !== undefined || values.endedAt !== undefined) {
    const startedAt = values.startedAt ?? new Date(current.startedAt)
    const endedAt = values.endedAt !== undefined ? values.endedAt : current.endedAt && new Date(current.endedAt)
    if (endedAt && endedAt < startedAt) {
      throw createError({ statusCode: 400, statusMessage: 'endedAt must not be before startedAt' })
    }
  }

  if (Object.keys(values).length) {
    try {
      await db.update(workoutSessions).set(values).where(eq(workoutSessions.id, id))
    } catch (err) {
      if (isUniqueViolation(err, 'workout_session_open')) {
        throw createError({
          statusCode: 409,
          statusMessage: 'A workout is already open',
          data: { session: await activeSession(userId) }
        })
      }
      throw err
    }
  }

  if (values.performedOn !== undefined) await refreshSessionDate(id, values.performedOn)

  return loadSession(userId, id)
}

export async function deleteSession(userId: number, id: number): Promise<void> {
  await loadSession(userId, id)
  await db.delete(workoutSessions).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
}
