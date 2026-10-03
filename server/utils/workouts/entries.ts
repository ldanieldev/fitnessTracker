import { and, eq } from 'drizzle-orm'
import type { WorkoutEntry, WorkoutSession, WorkoutSet } from '~~/shared/types/workout'
import { exercisePrefs, exercises, users, workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import type { WorkoutEntryPatchInput } from '~~/server/utils/workouts/input'
import { loadExerciseForUser } from '~~/server/utils/workouts/exercises'
import { loadSession } from '~~/server/utils/workouts/sessions'
import { refreshRollup } from '~~/server/utils/workouts/rollups'
import { historyForExercise, lastSetsForExercise } from '~~/server/utils/workouts/history'
import { recordsForEarlier } from '~~/shared/utils/workoutRecords'
import { DEFAULT_PLATE_SIZES, effectivePlateSizes } from '~~/shared/utils/plates'
import { toEntryTarget } from '~~/server/utils/workouts/targets'
import { regroup, SESSION_ENTRY_GROUPS, groupOrThrow } from '~~/server/utils/workouts/groups'
import { moveWithGroupsTo, normalizeGroups, ungroupItem } from '~~/shared/utils/supersets'

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
      .leftJoin(exercisePrefs, and(
        eq(exercisePrefs.userId, userId),
        eq(exercisePrefs.exerciseId, workoutEntries.exerciseId)
      ))
      .where(eq(workoutEntries.sessionId, sessionId))
      .orderBy(workoutEntries.sortOrder, workoutEntries.id),
    db.select({ plateSizes: users.plateSizes }).from(users).where(eq(users.id, userId)).then((r) => r[0])
  ])
  const defaultPlates = owner?.plateSizes ?? DEFAULT_PLATE_SIZES.map(String)

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
      restSeconds: row.restSeconds,
      plateSizes: effectivePlateSizes(row.loadStyle, row.prefPlateSizes, defaultPlates),
      notes: row.notes,
      target: toEntryTarget(row),
      supersetGroup: row.supersetGroup,
      optional: row.optional,
      restOverrideSeconds: row.restOverrideSeconds,
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

export async function patchEntry(
  userId: number,
  entryId: number,
  patch: WorkoutEntryPatchInput
): Promise<WorkoutSession> {
  const entry = await loadOwnedEntry(userId, entryId)

  await db.transaction(async (tx) => {
    if (patch.notes !== undefined) {
      await tx.update(workoutEntries).set({ notes: patch.notes }).where(eq(workoutEntries.id, entryId))
    }
    if (patch.supersetGroup === null) {
      await regroup(tx, SESSION_ENTRY_GROUPS, entry.sessionId, (items) => ungroupItem(items, entryId))
    }
    if (patch.sortOrder !== undefined && patch.sortOrder !== entry.sortOrder) {
      const target = patch.sortOrder
      await regroup(tx, SESSION_ENTRY_GROUPS, entry.sessionId, (items) =>
        moveWithGroupsTo(items, entryId, Math.min(target, items.length - 1)))
    }
  })

  return loadSession(userId, entry.sessionId)
}

export async function deleteEntry(userId: number, entryId: number): Promise<WorkoutSession> {
  const entry = await loadOwnedEntry(userId, entryId)
  await db.transaction(async (tx) => {
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
  await loadSession(userId, sessionId)
  await db.transaction(async (tx) => {
    await regroup(tx, SESSION_ENTRY_GROUPS, sessionId, (items) => groupOrThrow(items, entryIds))
  })
  return loadSession(userId, sessionId)
}
