import { and, count, eq, inArray } from 'drizzle-orm'
import type { WorkoutEntry, WorkoutSession, WorkoutSet } from '~~/shared/types/workout'
import { exercisePrefs, exercises, users, workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import type { WorkoutEntryPatchInput } from '~~/server/utils/workouts/input'
import { loadExerciseSettings } from '~~/server/utils/workouts/exercises'
import { assertOwnSession, loadSession } from '~~/server/utils/workouts/sessions'
import { refreshRollup } from '~~/server/utils/workouts/rollups'
import {
  earlierSetValues,
  lastSetsByExercise,
  withNumericMeasures,
  type SessionAnchor
} from '~~/server/utils/workouts/history'
import { recordsForEarlier, type HistorySet } from '~~/shared/utils/workoutRecords'
import { DEFAULT_PLATE_SIZES, effectivePlateSizes } from '~~/shared/utils/plates'
import { toEntryTarget } from '~~/server/utils/workouts/targets'
import { lockGroupRows, regroup, SESSION_ENTRY_GROUPS, groupOrThrow } from '~~/server/utils/workouts/groups'
import { moveWithGroupsTo, normalizeGroups, ungroupItem } from '~~/shared/utils/supersets'

const NOT_FOUND_ERROR = { statusCode: 404, statusMessage: 'Entry not found' } as const

async function loadSetRows(entryIds: number[]): Promise<{ entryId: number; set: WorkoutSet }[]> {
  if (!entryIds.length) return []
  const rows = await db
    .select({
      entryId: workoutSets.entryId,
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
    .where(inArray(workoutSets.entryId, entryIds))
    .orderBy(workoutSets.sortOrder, workoutSets.id)

  return rows.map(({ entryId, ...set }) => ({ entryId, set: { ...withNumericMeasures(set), records: [] } }))
}

export async function loadEntries(userId: number, session: SessionAnchor): Promise<WorkoutEntry[]> {
  const [rows, owner] = await Promise.all([
    db
      .select({
        id: workoutEntries.id,
        exerciseId: workoutEntries.exerciseId,
        exerciseName: exercises.name,
        sortOrder: workoutEntries.sortOrder,
        trackingType: workoutEntries.trackingType,
        loadStyle: workoutEntries.loadStyle,
        notes: workoutEntries.notes,
        targetSets: workoutEntries.targetSets,
        targetLow: workoutEntries.targetLow,
        targetHigh: workoutEntries.targetHigh,
        targetWeight: workoutEntries.targetWeight,
        supersetGroup: workoutEntries.supersetGroup,
        optional: workoutEntries.optional,
        restOverrideSeconds: workoutEntries.restSeconds,
        exerciseBarWeight: exercises.barWeight,
        prefBarWeight: exercisePrefs.barWeight,
        weightIncrement: exercisePrefs.weightIncrement,
        restSeconds: exercisePrefs.restSeconds,
        prefPlateSizes: exercisePrefs.plateSizes
      })
      .from(workoutEntries)
      .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
      .leftJoin(
        exercisePrefs,
        and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, workoutEntries.exerciseId))
      )
      .where(eq(workoutEntries.sessionId, session.id))
      .orderBy(workoutEntries.sortOrder, workoutEntries.id),
    db
      .select({ plateSizes: users.plateSizes })
      .from(users)
      .where(eq(users.id, userId))
      .then((r) => r[0])
  ])
  const defaultPlates = owner?.plateSizes ?? DEFAULT_PLATE_SIZES.map(String)

  const exerciseIds = [...new Set(rows.map((row) => row.exerciseId))]
  const [setRows, earlier, lastSets] = await Promise.all([
    loadSetRows(rows.map((row) => row.id)),
    earlierSetValues(userId, session, exerciseIds),
    lastSetsByExercise(userId, session, exerciseIds)
  ])

  const exerciseOfEntry = new Map(rows.map((row) => [row.id, row.exerciseId]))
  const history = new Map<number, HistorySet[]>(exerciseIds.map((id) => [id, earlier.get(id) ?? []]))
  // This session's sets follow every earlier session in set-id order, the order historyForExercise read them in.
  for (const { entryId, set } of [...setRows].sort((x, y) => x.set.id - y.set.id)) {
    history.get(exerciseOfEntry.get(entryId)!)!.push(set)
  }

  return rows.map((row) => {
    const barWeightRaw = row.prefBarWeight ?? row.exerciseBarWeight
    const sets = setRows
      .filter((candidate) => candidate.entryId === row.id)
      .map(({ set }) => ({
        ...set,
        records: recordsForEarlier(history.get(row.exerciseId)!, set.id, row.trackingType, row.loadStyle)
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
      restSeconds: row.restSeconds,
      plateSizes: effectivePlateSizes(row.loadStyle, row.prefPlateSizes, defaultPlates),
      notes: row.notes,
      target: toEntryTarget(row),
      supersetGroup: row.supersetGroup,
      optional: row.optional,
      restOverrideSeconds: row.restOverrideSeconds,
      sets,
      lastSets: lastSets.get(row.exerciseId) ?? []
    }
  })
}

export async function addEntry(userId: number, sessionId: number, exerciseId: number): Promise<WorkoutSession> {
  await db.transaction(async (tx) => {
    // Session row first: it queues behind a session delete and other adds even when the workout has no entries yet.
    const owned = await tx
      .select({ id: workoutSessions.id })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, userId)))
      .for('no key update')
    if (!owned.length) throw createError({ statusCode: 404, statusMessage: 'Workout not found' })
    await lockGroupRows(tx, SESSION_ENTRY_GROUPS, sessionId)
    const exercise = await loadExerciseSettings(userId, exerciseId)
    const entries = await tx
      .select({ n: count() })
      .from(workoutEntries)
      .where(eq(workoutEntries.sessionId, sessionId))
      .then((r) => r[0]!.n)
    await tx.insert(workoutEntries).values({
      sessionId,
      exerciseId,
      sortOrder: entries,
      trackingType: exercise.trackingType,
      loadStyle: exercise.loadStyle
    })
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

export async function patchEntry(
  userId: number,
  entryId: number,
  patch: WorkoutEntryPatchInput
): Promise<WorkoutSession> {
  const entry = await loadOwnedEntry(userId, entryId)

  await db.transaction(async (tx) => {
    // A regroup locks in id order; the notes write must not take this row out of that order first.
    const locked =
      patch.supersetGroup === null || patch.sortOrder !== undefined
        ? await lockGroupRows(tx, SESSION_ENTRY_GROUPS, entry.sessionId)
        : null
    const current = locked?.find((row) => row.id === entryId)
    if (locked && !current) throw createError(NOT_FOUND_ERROR)
    if (patch.notes !== undefined) {
      await tx.update(workoutEntries).set({ notes: patch.notes }).where(eq(workoutEntries.id, entryId))
    }
    if (patch.supersetGroup === null) {
      await regroup(tx, SESSION_ENTRY_GROUPS, entry.sessionId, (items) => ungroupItem(items, entryId))
    }
    if (patch.sortOrder !== undefined && patch.sortOrder !== current!.sortOrder) {
      const target = patch.sortOrder
      await regroup(tx, SESSION_ENTRY_GROUPS, entry.sessionId, (items) =>
        moveWithGroupsTo(items, entryId, Math.min(target, items.length - 1))
      )
    }
  })

  return loadSession(userId, entry.sessionId)
}

export async function deleteEntry(userId: number, entryId: number): Promise<WorkoutSession> {
  const entry = await loadOwnedEntry(userId, entryId)
  await db.transaction(async (tx) => {
    await lockGroupRows(tx, SESSION_ENTRY_GROUPS, entry.sessionId)
    await tx.delete(workoutEntries).where(eq(workoutEntries.id, entryId))
    await regroup(tx, SESSION_ENTRY_GROUPS, entry.sessionId, normalizeGroups)
  })
  await refreshRollup(userId, entry.sessionId, entry.exerciseId)
  return loadSession(userId, entry.sessionId)
}

export async function groupSessionEntries(
  userId: number,
  sessionId: number,
  entryIds: number[]
): Promise<WorkoutSession> {
  await assertOwnSession(userId, sessionId)
  await db.transaction(async (tx) => {
    await regroup(tx, SESSION_ENTRY_GROUPS, sessionId, (items) => groupOrThrow(items, entryIds))
  })
  return loadSession(userId, sessionId)
}
