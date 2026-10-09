import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { WorkoutSession, WorkoutSessionSummary } from '~~/shared/types/workout'
import { programPhases, workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import type { SessionListQuery, SessionPatchInput } from '~~/server/utils/workouts/input'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { loadEntries } from '~~/server/utils/workouts/entries'
import { loadEntryCategories, sessionCategoryDots } from '~~/server/utils/workouts/sessionCategories'
import { sessionFilterWhere } from '~~/server/utils/workouts/sessionFilter'
import { refreshSessionDate, stampGoals } from '~~/server/utils/workouts/rollups'

const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Workout not found' } as const

async function phaseDeload(phaseId: number | null): Promise<boolean> {
  if (phaseId === null) return false
  const [row] = await db
    .select({ deload: programPhases.deload })
    .from(programPhases)
    .where(eq(programPhases.id, phaseId))
  return row?.deload ?? false
}

async function toSession(row: typeof workoutSessions.$inferSelect): Promise<WorkoutSession> {
  return {
    id: row.id,
    name: row.name,
    performedOn: row.performedOn,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    notes: row.notes,
    routineDayId: row.routineDayId,
    deload: await phaseDeload(row.programPhaseId),
    entries: await loadEntries(row.userId, row)
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

export async function rethrowOpenSessionConflict(userId: number, err: unknown): Promise<never> {
  if (isUniqueViolation(err, 'workout_session_open')) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A workout is already open',
      data: { session: await activeSession(userId) }
    })
  }
  throw err
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

export async function listSessions(userId: number, query: SessionListQuery): Promise<WorkoutSessionSummary[]> {
  const rows = await db
    .select({
      id: workoutSessions.id,
      name: workoutSessions.name,
      performedOn: workoutSessions.performedOn,
      startedAt: workoutSessions.startedAt,
      endedAt: workoutSessions.endedAt,
      exerciseCount,
      setCount,
      programPhaseId: workoutSessions.programPhaseId,
      programWeek: workoutSessions.programWeek,
      phaseName: programPhases.name,
      phaseSort: programPhases.sortOrder
    })
    .from(workoutSessions)
    .leftJoin(programPhases, eq(programPhases.id, workoutSessions.programPhaseId))
    .where(sessionFilterWhere(userId, query))
    .orderBy(desc(workoutSessions.performedOn), desc(workoutSessions.startedAt), desc(workoutSessions.id))
    .limit(query.limit)

  const dots = sessionCategoryDots(
    await loadEntryCategories(
      userId,
      rows.map((row) => row.id)
    )
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    performedOn: row.performedOn,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    exerciseCount: row.exerciseCount,
    setCount: row.setCount,
    categories: dots.get(row.id) ?? [],
    program:
      row.programPhaseId !== null && row.phaseName !== null && row.phaseSort !== null && row.programWeek !== null
        ? { phaseId: row.programPhaseId, phaseName: row.phaseName, phaseIndex: row.phaseSort, week: row.programWeek }
        : null
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

export async function assertOwnSession(userId: number, id: number): Promise<void> {
  const row = await db
    .select({ id: workoutSessions.id })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(NOT_FOUND_ERROR)
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
      await rethrowOpenSessionConflict(userId, err)
    }
  }

  if (values.performedOn !== undefined) await refreshSessionDate(id, values.performedOn)

  return loadSession(userId, id)
}

export async function deleteSession(userId: number, id: number): Promise<void> {
  await assertOwnSession(userId, id)
  const touched = await db
    .selectDistinct({ exerciseId: workoutEntries.exerciseId })
    .from(workoutEntries)
    .where(eq(workoutEntries.sessionId, id))
  await db.delete(workoutSessions).where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, userId)))
  // The cascade drops this session's rollups, so goals it earned are re-checked against what is left.
  for (const { exerciseId } of touched) await stampGoals(userId, exerciseId)
}
