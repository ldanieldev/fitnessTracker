import { asc, eq } from 'drizzle-orm'
import type { EntryTarget, LoadStyle, PointerChoice, TrackingType, WorkoutSession } from '~~/shared/types/workout'
import { routines, workoutEntries, workoutSessions, workoutTemplateEntries } from '~~/server/db/schema'
import { db, type DbClient } from '~~/server/utils/db'
import type { SessionStartInput } from '~~/server/utils/workouts/input'
import { sessionProgramTag } from '~~/server/utils/workouts/enrollments'
import { loadExerciseSettings } from '~~/server/utils/workouts/exercises'
import { loadSession, rethrowOpenSessionConflict } from '~~/server/utils/workouts/sessions'
import { DAY_NOT_FOUND, ownedRoutineDay } from '~~/server/utils/workouts/routineDays'
import { cycleDays, lockRoutine } from '~~/server/utils/workouts/routines'
import { targetColumns, toEntryTarget } from '~~/server/utils/workouts/targets'
import { advancePointer, needsPointerChoice } from '~~/shared/utils/routineCycle'
import { normalizeGroups } from '~~/shared/utils/supersets'
import { copyTargetsFrom } from '~~/shared/utils/workoutTargets'

interface PlannedEntry {
  id: number
  exerciseId: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
  notes: string | null
  target: EntryTarget | null
  supersetGroup: number | null
  optional: boolean
  restSeconds: number | null
}

async function resolveExercises<T extends { exerciseId: number }>(userId: number, rows: T[]) {
  const resolved: (T & { trackingType: TrackingType, loadStyle: LoadStyle | null })[] = []
  for (const row of rows) {
    try {
      const exercise = await loadExerciseSettings(userId, row.exerciseId)
      resolved.push({ ...row, trackingType: exercise.trackingType, loadStyle: exercise.loadStyle })
    } catch (err) {
      if (!(err instanceof Error && 'statusCode' in err && err.statusCode === 404)) throw err
    }
  }
  return resolved
}

interface DayClaim {
  dayId: number
  name: string
  routineId: number
  nextDayId: number | null
}

async function claimRoutineDay(tx: DbClient, userId: number, dayId: number, choice: PointerChoice | undefined): Promise<DayClaim> {
  const { routineId } = await ownedRoutineDay(userId, dayId, tx)
  // Routine row before any day row, everywhere: every day writer holds it, so no day can vanish while the start runs.
  const routine = await lockRoutine(tx, userId, routineId)
  const day = await ownedRoutineDay(userId, dayId, tx)
  if (day.routineId !== routine.id) throw createError(DAY_NOT_FOUND)
  const days = await cycleDays(day.routineId, tx)
  if (needsPointerChoice(days, routine.nextDayId, day.id) && !choice) {
    throw createError({ statusCode: 400, statusMessage: 'Choose whether to skip or keep the day that is next' })
  }
  return {
    dayId: day.id,
    name: day.name,
    routineId: day.routineId,
    nextDayId: advancePointer(days, routine.nextDayId, day.id, choice)
  }
}

async function routineDayEntries(tx: DbClient, userId: number, dayId: number): Promise<PlannedEntry[]> {
  const rows = await tx.select().from(workoutTemplateEntries).where(eq(workoutTemplateEntries.templateId, dayId))
    .orderBy(asc(workoutTemplateEntries.sortOrder), asc(workoutTemplateEntries.id))
  const resolved = await resolveExercises(userId, rows)
  return normalizeGroups(resolved.map((row) => ({
    id: row.id,
    exerciseId: row.exerciseId,
    trackingType: row.trackingType,
    loadStyle: row.loadStyle,
    notes: row.notes,
    target: toEntryTarget(row),
    supersetGroup: row.supersetGroup,
    optional: row.optional,
    restSeconds: row.restSeconds
  })))
}

async function copiedEntries(userId: number, copyFromId: number, entryIds: number[] | undefined): Promise<PlannedEntry[]> {
  const source = await loadSession(userId, copyFromId)
  if (entryIds?.some((id) => !source.entries.some((entry) => entry.id === id))) {
    throw createError({ statusCode: 400, statusMessage: 'Those exercises are not in that workout' })
  }
  const picked = entryIds ? source.entries.filter((entry) => entryIds.includes(entry.id)) : source.entries
  const resolved = await resolveExercises(userId, picked.map((entry) => ({
    id: entry.id,
    exerciseId: entry.exerciseId,
    sourceTrackingType: entry.trackingType,
    sets: entry.sets,
    sourceTarget: entry.target,
    supersetGroup: entry.supersetGroup,
    optional: entry.optional,
    restSeconds: entry.restOverrideSeconds
  })))
  return normalizeGroups(resolved.map((row) => ({
    id: row.id,
    exerciseId: row.exerciseId,
    trackingType: row.trackingType,
    loadStyle: row.loadStyle,
    notes: null,
    target: copyTargetsFrom(row.trackingType, row.sets, row.sourceTarget, row.sourceTrackingType),
    supersetGroup: row.supersetGroup,
    optional: row.optional,
    restSeconds: row.restSeconds
  })))
}

export async function startSession(userId: number, input: SessionStartInput): Promise<WorkoutSession> {
  if (input.routineDayId !== undefined && input.copyFromId !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Start from a routine day or a past workout, not both' })
  }
  if (input.entryIds !== undefined && input.copyFromId === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a workout to copy from' })
  }
  if (input.pointer !== undefined && input.routineDayId === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a routine day for that choice' })
  }

  try {
    const id = await db.transaction(async (tx) => {
      const claim = input.routineDayId !== undefined
        ? await claimRoutineDay(tx, userId, input.routineDayId, input.pointer)
        : null
      const tag = await sessionProgramTag(tx, userId, input.performedOn)
      // Insert before reading entries so the open-workout index refuses a second start before the expensive reads.
      const row = await tx
        .insert(workoutSessions)
        .values({
          userId,
          name: input.name ?? claim?.name ?? null,
          performedOn: input.performedOn,
          routineDayId: claim?.dayId ?? null,
          ...(tag ?? {})
        })
        .returning({ id: workoutSessions.id })
        .then((r) => r[0]!)
      const entries = claim
        ? await routineDayEntries(tx, userId, claim.dayId)
        : input.copyFromId !== undefined
          ? await copiedEntries(userId, input.copyFromId, input.entryIds)
          : []
      for (const [index, entry] of entries.entries()) {
        await tx.insert(workoutEntries).values({
          sessionId: row.id,
          exerciseId: entry.exerciseId,
          sortOrder: index,
          trackingType: entry.trackingType,
          loadStyle: entry.loadStyle,
          notes: entry.notes,
          ...targetColumns(entry.target),
          supersetGroup: entry.supersetGroup,
          optional: entry.optional,
          restSeconds: entry.restSeconds
        })
      }
      if (claim) await tx.update(routines).set({ nextDayId: claim.nextDayId }).where(eq(routines.id, claim.routineId))
      return row.id
    })
    return loadSession(userId, id)
  } catch (err) {
    return rethrowOpenSessionConflict(userId, err)
  }
}
