import { asc, eq } from 'drizzle-orm'
import type { EntryTarget, LoadStyle, PointerChoice, TrackingType, WorkoutSession } from '~~/shared/types/workout'
import { routines, workoutEntries, workoutSessions, workoutTemplateEntries } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { isUniqueViolation } from '~~/server/utils/pgError'
import type { SessionStartInput } from '~~/server/utils/workouts/input'
import { loadCatalogue } from '~~/server/utils/workouts/catalogue'
import { loadExerciseForUser } from '~~/server/utils/workouts/exercises'
import { activeSession, loadSession } from '~~/server/utils/workouts/sessions'
import { ownedRoutineDay } from '~~/server/utils/workouts/routineDays'
import { cycleDays } from '~~/server/utils/workouts/routines'
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

interface StartPlan {
  name: string | null
  routineDayId: number | null
  entries: PlannedEntry[]
  pointer: { routineId: number, nextDayId: number | null } | null
}

async function resolveExercises<T extends { exerciseId: number }>(userId: number, rows: T[]) {
  const catalogue = await loadCatalogue()
  const resolved: (T & { trackingType: TrackingType, loadStyle: LoadStyle | null })[] = []
  for (const row of rows) {
    try {
      const exercise = await loadExerciseForUser(userId, row.exerciseId, catalogue)
      resolved.push({ ...row, trackingType: exercise.trackingType, loadStyle: exercise.loadStyle })
    } catch (err) {
      if (!(err instanceof Error && 'statusCode' in err && err.statusCode === 404)) throw err
    }
  }
  return resolved
}

async function planFromRoutineDay(userId: number, dayId: number, choice: PointerChoice | undefined): Promise<StartPlan> {
  const day = await ownedRoutineDay(userId, dayId)
  const routine = await db.select({ id: routines.id, nextDayId: routines.nextDayId }).from(routines)
    .where(eq(routines.id, day.routineId)).then((r) => r[0]!)
  const days = await cycleDays(day.routineId)
  if (needsPointerChoice(days, routine.nextDayId, day.id) && !choice) {
    throw createError({ statusCode: 400, statusMessage: 'Choose whether to skip or keep the day that is next' })
  }
  const rows = await db.select().from(workoutTemplateEntries).where(eq(workoutTemplateEntries.templateId, day.id))
    .orderBy(asc(workoutTemplateEntries.sortOrder), asc(workoutTemplateEntries.id))
  const resolved = await resolveExercises(userId, rows)
  return {
    name: day.name,
    routineDayId: day.id,
    entries: normalizeGroups(resolved.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      trackingType: row.trackingType,
      loadStyle: row.loadStyle,
      notes: row.notes,
      target: toEntryTarget(row),
      supersetGroup: row.supersetGroup,
      optional: row.optional,
      restSeconds: row.restSeconds
    }))),
    pointer: { routineId: routine.id, nextDayId: advancePointer(days, routine.nextDayId, day.id, choice) }
  }
}

async function planFromCopy(userId: number, copyFromId: number, entryIds: number[] | undefined): Promise<StartPlan> {
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
  return {
    name: null,
    routineDayId: null,
    entries: normalizeGroups(resolved.map((row) => ({
      id: row.id,
      exerciseId: row.exerciseId,
      trackingType: row.trackingType,
      loadStyle: row.loadStyle,
      notes: null,
      target: copyTargetsFrom(row.sourceTrackingType, row.sets, row.sourceTarget),
      supersetGroup: row.supersetGroup,
      optional: row.optional,
      restSeconds: row.restSeconds
    }))),
    pointer: null
  }
}

export async function startSession(userId: number, input: SessionStartInput): Promise<WorkoutSession> {
  if (input.routineDayId !== undefined && input.copyFromId !== undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Start from a routine day or a past workout, not both' })
  }
  if (input.entryIds !== undefined && input.copyFromId === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a workout to copy from' })
  }
  const performedOn = input.performedOn ?? new Date().toISOString().slice(0, 10)
  const plan = input.routineDayId !== undefined
    ? await planFromRoutineDay(userId, input.routineDayId, input.pointer)
    : input.copyFromId !== undefined
      ? await planFromCopy(userId, input.copyFromId, input.entryIds)
      : null

  try {
    const id = await db.transaction(async (tx) => {
      const row = await tx
        .insert(workoutSessions)
        .values({ userId, name: input.name ?? plan?.name ?? null, performedOn, routineDayId: plan?.routineDayId ?? null })
        .returning({ id: workoutSessions.id })
        .then((r) => r[0]!)
      for (const [index, entry] of (plan?.entries ?? []).entries()) {
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
      if (plan?.pointer) {
        await tx.update(routines).set({ nextDayId: plan.pointer.nextDayId }).where(eq(routines.id, plan.pointer.routineId))
      }
      return row.id
    })
    return loadSession(userId, id)
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
