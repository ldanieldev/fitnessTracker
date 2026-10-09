import { and, eq } from 'drizzle-orm'
import type { Routine } from '~~/shared/types/routine'
import { routines, workoutTemplateEntries, workoutTemplates } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { RoutineDayCreateInput, RoutineDayPatchInput, RoutineEntryPatchInput } from '~~/server/utils/workouts/input'
import { loadExerciseSettings } from '~~/server/utils/workouts/exercises'
import { loadRoutine, lockRoutine } from '~~/server/utils/workouts/routines'
import { groupOrThrow, regroup, ROUTINE_ENTRY_GROUPS } from '~~/server/utils/workouts/groups'
import { renumberSiblings, siblingIds } from '~~/server/utils/workouts/sortOrder'
import { moveWithGroupsTo, normalizeGroups, ungroupItem } from '~~/shared/utils/supersets'

export const DAY_NOT_FOUND = { statusCode: 404, statusMessage: 'Routine day not found' } as const
const ENTRY_NOT_FOUND = { statusCode: 404, statusMessage: 'Routine exercise not found' } as const

export async function ownedRoutineDay(userId: number, dayId: number, client: DbClient = db) {
  const row = await client
    .select({
      id: workoutTemplates.id,
      routineId: workoutTemplates.routineId,
      name: workoutTemplates.name,
      floating: workoutTemplates.floating
    })
    .from(workoutTemplates)
    .innerJoin(routines, eq(routines.id, workoutTemplates.routineId))
    .where(and(eq(workoutTemplates.id, dayId), eq(routines.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(DAY_NOT_FOUND)
  return row as typeof row & { routineId: number }
}

async function ownedRoutineEntry(userId: number, entryId: number, client: DbClient = db) {
  const row = await client
    .select({
      id: workoutTemplateEntries.id,
      templateId: workoutTemplateEntries.templateId,
      routineId: workoutTemplates.routineId,
      targetLow: workoutTemplateEntries.targetLow,
      targetHigh: workoutTemplateEntries.targetHigh
    })
    .from(workoutTemplateEntries)
    .innerJoin(workoutTemplates, eq(workoutTemplates.id, workoutTemplateEntries.templateId))
    .innerJoin(routines, eq(routines.id, workoutTemplates.routineId))
    .where(and(eq(workoutTemplateEntries.id, entryId), eq(routines.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(ENTRY_NOT_FOUND)
  return row as typeof row & { routineId: number }
}

const daySiblings = (tx: DbClient, routineId: number) =>
  siblingIds(tx, workoutTemplates, workoutTemplates.id, workoutTemplates.sortOrder, workoutTemplates.routineId, routineId)

// Routine row before any day or entry row, the same order startSession takes, so routine writes never deadlock.
async function lockedRoutineDay(tx: DbClient, userId: number, dayId: number) {
  const { routineId } = await ownedRoutineDay(userId, dayId, tx)
  await lockRoutine(tx, userId, routineId)
  return ownedRoutineDay(userId, dayId, tx)
}

async function lockedRoutineEntry(tx: DbClient, userId: number, entryId: number) {
  const { routineId } = await ownedRoutineEntry(userId, entryId, tx)
  await lockRoutine(tx, userId, routineId)
  return ownedRoutineEntry(userId, entryId, tx)
}

export async function addRoutineDay(userId: number, routineId: number, input: RoutineDayCreateInput): Promise<Routine> {
  await db.transaction(async (tx) => {
    await lockRoutine(tx, userId, routineId)
    const days = await daySiblings(tx, routineId)
    await tx.insert(workoutTemplates).values({
      userId,
      routineId,
      name: input.name,
      floating: input.floating ?? false,
      sortOrder: days.length
    })
  })
  return loadRoutine(userId, routineId)
}

export async function patchRoutineDay(userId: number, dayId: number, patch: RoutineDayPatchInput): Promise<Routine> {
  const day = await db.transaction(async (tx) => {
    const day = await lockedRoutineDay(tx, userId, dayId)
    const values: Partial<typeof workoutTemplates.$inferInsert> = {}
    if (patch.name !== undefined) values.name = patch.name
    if (patch.description !== undefined) values.description = patch.description || null
    if (patch.floating !== undefined) values.floating = patch.floating
    if (Object.keys(values).length) await tx.update(workoutTemplates).set(values).where(eq(workoutTemplates.id, dayId))
    if (patch.sortOrder !== undefined) {
      const ids = (await daySiblings(tx, day.routineId)).filter((id) => id !== dayId)
      ids.splice(Math.min(Math.max(patch.sortOrder, 0), ids.length), 0, dayId)
      await renumberSiblings(tx, workoutTemplates, workoutTemplates.id, workoutTemplates.sortOrder, ids)
    }
    return day
  })
  return loadRoutine(userId, day.routineId)
}

export async function deleteRoutineDay(userId: number, dayId: number): Promise<Routine> {
  const day = await db.transaction(async (tx) => {
    const day = await lockedRoutineDay(tx, userId, dayId)
    await tx.delete(workoutTemplates).where(eq(workoutTemplates.id, dayId))
    await renumberSiblings(tx, workoutTemplates, workoutTemplates.id, workoutTemplates.sortOrder, await daySiblings(tx, day.routineId))
    return day
  })
  return loadRoutine(userId, day.routineId)
}

export async function addRoutineEntry(userId: number, dayId: number, exerciseId: number): Promise<Routine> {
  await ownedRoutineDay(userId, dayId)
  await loadExerciseSettings(userId, exerciseId)
  const day = await db.transaction(async (tx) => {
    const day = await lockedRoutineDay(tx, userId, dayId)
    const count = (await siblingIds(
      tx, workoutTemplateEntries, workoutTemplateEntries.id, workoutTemplateEntries.sortOrder,
      workoutTemplateEntries.templateId, dayId
    )).length
    await tx.insert(workoutTemplateEntries).values({ templateId: dayId, exerciseId, sortOrder: count, targetSets: 3 })
    return day
  })
  return loadRoutine(userId, day.routineId)
}

export async function patchRoutineEntry(userId: number, entryId: number, patch: RoutineEntryPatchInput): Promise<Routine> {
  const entry = await db.transaction(async (tx) => {
    const entry = await lockedRoutineEntry(tx, userId, entryId)
    const low = patch.targetLow !== undefined ? patch.targetLow : entry.targetLow === null ? null : Number(entry.targetLow)
    const high = patch.targetHigh !== undefined ? patch.targetHigh : entry.targetHigh === null ? null : Number(entry.targetHigh)
    if (low !== null && high !== null && low > high) {
      throw createError({ statusCode: 400, statusMessage: 'The range must run low to high' })
    }
    const values: Partial<typeof workoutTemplateEntries.$inferInsert> = {}
    if (patch.targetSets !== undefined) values.targetSets = patch.targetSets
    if (patch.targetLow !== undefined) values.targetLow = patch.targetLow === null ? null : String(patch.targetLow)
    if (patch.targetHigh !== undefined) values.targetHigh = patch.targetHigh === null ? null : String(patch.targetHigh)
    if (patch.targetWeight !== undefined) values.targetWeight = patch.targetWeight === null ? null : String(patch.targetWeight)
    if (patch.optional !== undefined) values.optional = patch.optional
    if (patch.restSeconds !== undefined) values.restSeconds = patch.restSeconds
    if (patch.notes !== undefined) values.notes = patch.notes || null
    if (Object.keys(values).length) {
      await tx.update(workoutTemplateEntries).set(values).where(eq(workoutTemplateEntries.id, entryId))
    }
    if (patch.supersetGroup === null) {
      await regroup(tx, ROUTINE_ENTRY_GROUPS, entry.templateId, (items) => ungroupItem(items, entryId))
    }
    if (patch.sortOrder !== undefined) {
      const target = patch.sortOrder
      await regroup(tx, ROUTINE_ENTRY_GROUPS, entry.templateId, (items) =>
        moveWithGroupsTo(items, entryId, Math.min(target, items.length - 1)))
    }
    return entry
  })
  return loadRoutine(userId, entry.routineId)
}

export async function deleteRoutineEntry(userId: number, entryId: number): Promise<Routine> {
  const entry = await db.transaction(async (tx) => {
    const entry = await lockedRoutineEntry(tx, userId, entryId)
    await tx.delete(workoutTemplateEntries).where(eq(workoutTemplateEntries.id, entryId))
    await regroup(tx, ROUTINE_ENTRY_GROUPS, entry.templateId, normalizeGroups)
    return entry
  })
  return loadRoutine(userId, entry.routineId)
}

export async function groupRoutineEntries(userId: number, dayId: number, entryIds: number[]): Promise<Routine> {
  const day = await db.transaction(async (tx) => {
    const day = await lockedRoutineDay(tx, userId, dayId)
    await regroup(tx, ROUTINE_ENTRY_GROUPS, dayId, (items) => groupOrThrow(items, entryIds))
    return day
  })
  return loadRoutine(userId, day.routineId)
}
