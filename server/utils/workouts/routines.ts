import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { Routine, RoutineDay, RoutineEntry, RoutineSummary } from '~~/shared/types/routine'
import { exercisePrefs, exercises, programs, routines, workoutTemplateEntries, workoutTemplates } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { RoutineCreateInput, RoutinePatchInput } from '~~/server/utils/workouts/input'
import { pauseLiveEnrollment, programControllingRoutine, programsUsingRoutine, utcToday } from '~~/server/utils/workouts/enrollments'
import { targetColumns, toEntryTarget } from '~~/server/utils/workouts/targets'
import { dueDayId, skipPointer } from '~~/shared/utils/routineCycle'

const ROUTINE_NOT_FOUND = { statusCode: 404, statusMessage: 'Routine not found' } as const

export async function ownedRoutine(userId: number, id: number, client: DbClient = db) {
  const row = await client
    .select()
    .from(routines)
    .where(and(eq(routines.id, id), eq(routines.userId, userId)))
    .then((r) => r[0])
  if (!row) throw createError(ROUTINE_NOT_FOUND)
  return row
}

export async function cycleDays(routineId: number, client: DbClient = db) {
  return client
    .select({ id: workoutTemplates.id, name: workoutTemplates.name, floating: workoutTemplates.floating })
    .from(workoutTemplates)
    .where(eq(workoutTemplates.routineId, routineId))
    .orderBy(asc(workoutTemplates.sortOrder), asc(workoutTemplates.id))
}

export async function listRoutines(userId: number): Promise<RoutineSummary[]> {
  const rows = await db.select().from(routines).where(eq(routines.userId, userId))
  if (!rows.length) return []
  const days = await db
    .select({
      id: workoutTemplates.id,
      routineId: workoutTemplates.routineId,
      name: workoutTemplates.name,
      floating: workoutTemplates.floating
    })
    .from(workoutTemplates)
    .where(inArray(workoutTemplates.routineId, rows.map((row) => row.id)))
    .orderBy(asc(workoutTemplates.sortOrder), asc(workoutTemplates.id))

  return rows
    .map((row) => {
      const own = days.filter((day) => day.routineId === row.id)
      const due = own.find((day) => day.id === dueDayId(own, row.nextDayId))
      return {
        id: row.id,
        name: row.name,
        active: row.active,
        dayCount: own.length,
        nextDay: due ? { id: due.id, name: due.name } : null
      }
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
}

export async function loadRoutine(userId: number, id: number): Promise<Routine> {
  const row = await ownedRoutine(userId, id)
  const days = await db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.routineId, id))
    .orderBy(asc(workoutTemplates.sortOrder), asc(workoutTemplates.id))
  const entries = days.length
    ? await db
        .select({
          id: workoutTemplateEntries.id,
          templateId: workoutTemplateEntries.templateId,
          exerciseId: workoutTemplateEntries.exerciseId,
          exerciseName: exercises.name,
          trackingType: exercises.trackingType,
          prefTrackingType: exercisePrefs.trackingType,
          deletedAt: exercises.deletedAt,
          sortOrder: workoutTemplateEntries.sortOrder,
          targetSets: workoutTemplateEntries.targetSets,
          targetLow: workoutTemplateEntries.targetLow,
          targetHigh: workoutTemplateEntries.targetHigh,
          targetWeight: workoutTemplateEntries.targetWeight,
          supersetGroup: workoutTemplateEntries.supersetGroup,
          optional: workoutTemplateEntries.optional,
          restSeconds: workoutTemplateEntries.restSeconds,
          notes: workoutTemplateEntries.notes
        })
        .from(workoutTemplateEntries)
        .innerJoin(exercises, eq(exercises.id, workoutTemplateEntries.exerciseId))
        .leftJoin(
          exercisePrefs,
          and(eq(exercisePrefs.userId, userId), eq(exercisePrefs.exerciseId, workoutTemplateEntries.exerciseId))
        )
        .where(inArray(workoutTemplateEntries.templateId, days.map((day) => day.id)))
        .orderBy(asc(workoutTemplateEntries.sortOrder), asc(workoutTemplateEntries.id))
    : []

  const toEntry = (entry: (typeof entries)[number]): RoutineEntry => ({
    id: entry.id,
    exerciseId: entry.exerciseId,
    exerciseName: entry.exerciseName,
    trackingType: entry.prefTrackingType ?? entry.trackingType,
    deleted: entry.deletedAt !== null,
    sortOrder: entry.sortOrder,
    target: toEntryTarget(entry),
    supersetGroup: entry.supersetGroup,
    optional: entry.optional,
    restSeconds: entry.restSeconds,
    notes: entry.notes
  })

  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    active: row.active,
    nextDayId: dueDayId(days, row.nextDayId),
    days: days.map((day): RoutineDay => ({
      id: day.id,
      name: day.name,
      description: day.description,
      floating: day.floating,
      sortOrder: day.sortOrder,
      entries: entries.filter((entry) => entry.templateId === day.id).map(toEntry)
    }))
  }
}

export async function createRoutine(userId: number, input: RoutineCreateInput): Promise<Routine> {
  const row = await db
    .insert(routines)
    .values({ userId, name: input.name })
    .returning({ id: routines.id })
    .then((r) => r[0]!)
  return loadRoutine(userId, row.id)
}

export async function patchRoutine(userId: number, id: number, patch: RoutinePatchInput): Promise<Routine> {
  await db.transaction(async (tx) => {
    await ownedRoutine(userId, id, tx)
    const days = await cycleDays(id, tx)
    const values: Partial<typeof routines.$inferInsert> = {}
    if (patch.name !== undefined) values.name = patch.name
    if (patch.notes !== undefined) values.notes = patch.notes
    if (patch.nextDayId !== undefined) {
      const day = days.find((candidate) => candidate.id === patch.nextDayId)
      if (!day) throw createError({ statusCode: 400, statusMessage: 'That day is not part of this routine' })
      if (day.floating) throw createError({ statusCode: 400, statusMessage: 'A floating day cannot be next' })
      values.nextDayId = day.id
    }
    if (patch.active !== undefined) {
      const today = patch.today ?? utcToday()
      const live = await programControllingRoutine(tx, userId, today)
      if (live) {
        if (!patch.pauseProgram) {
          const program = await tx.select({ id: programs.id, name: programs.name }).from(programs)
            .where(eq(programs.id, live.programId)).then((r) => r[0]!)
          throw createError({
            statusCode: 409,
            statusMessage: `${program.name} controls your active routine`,
            data: { code: 'program_controls_routine', program }
          })
        }
        await pauseLiveEnrollment(tx, userId, today)
      }
    }
    if (patch.active === true) {
      if (!days.length)
        throw createError({ statusCode: 400, statusMessage: 'Add a day before making this routine active' })
      await tx.update(routines).set({ active: false }).where(and(eq(routines.userId, userId), ne(routines.id, id)))
    }
    if (patch.active !== undefined) values.active = patch.active
    if (Object.keys(values).length) await tx.update(routines).set(values).where(eq(routines.id, id))
  })
  return loadRoutine(userId, id)
}

export async function deleteRoutine(userId: number, id: number): Promise<void> {
  await ownedRoutine(userId, id)
  const using = await programsUsingRoutine(db, id)
  if (using.length) {
    throw createError({
      statusCode: 409,
      statusMessage: `Used by ${using.map((p) => p.name).join(', ')} - remove it from those phases first`,
      data: { code: 'routine_in_program', programs: using }
    })
  }
  await db.delete(routines).where(eq(routines.id, id))
}

export async function skipRoutineDay(userId: number, id: number): Promise<Routine> {
  const row = await ownedRoutine(userId, id)
  const days = await cycleDays(id)
  await db.update(routines).set({ nextDayId: skipPointer(days, row.nextDayId) }).where(eq(routines.id, id))
  return loadRoutine(userId, id)
}

export async function duplicateRoutine(userId: number, id: number): Promise<Routine> {
  const source = await loadRoutine(userId, id)
  const copyId = await db.transaction(async (tx) => {
    const copy = await tx
      .insert(routines)
      .values({ userId, name: `${source.name} (copy)`.slice(0, 255), notes: source.notes })
      .returning({ id: routines.id })
      .then((r) => r[0]!)
    for (const day of source.days) {
      const newDay = await tx
        .insert(workoutTemplates)
        .values({
          userId,
          routineId: copy.id,
          name: day.name,
          description: day.description,
          floating: day.floating,
          sortOrder: day.sortOrder
        })
        .returning({ id: workoutTemplates.id })
        .then((r) => r[0]!)
      if (!day.entries.length) continue
      await tx.insert(workoutTemplateEntries).values(
        day.entries.map((entry) => ({
          templateId: newDay.id,
          exerciseId: entry.exerciseId,
          sortOrder: entry.sortOrder,
          ...targetColumns(entry.target),
          supersetGroup: entry.supersetGroup,
          optional: entry.optional,
          restSeconds: entry.restSeconds,
          notes: entry.notes
        }))
      )
    }
    return copy.id
  })
  return loadRoutine(userId, copyId)
}
