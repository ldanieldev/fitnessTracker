import { asc, eq, inArray } from 'drizzle-orm'
import { exercises, workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import type { SessionFilterQuery } from '~~/server/utils/workouts/input'
import { loadEntryCategories } from '~~/server/utils/workouts/sessionCategories'
import { sessionFilterWhere } from '~~/server/utils/workouts/sessionFilter'
import { supersetLabel } from '~~/shared/utils/supersets'
import type { WorkoutCsvRow } from '~~/shared/utils/workoutExport'

const num = (value: string | null) => (value === null ? null : Number(value))

export async function loadWorkoutCsvRows(userId: number, filter: SessionFilterQuery): Promise<WorkoutCsvRow[]> {
  const sets = await db
    .select({
      sessionId: workoutSessions.id,
      performedOn: workoutSessions.performedOn,
      sessionName: workoutSessions.name,
      sessionNotes: workoutSessions.notes,
      entryId: workoutEntries.id,
      loadStyle: workoutEntries.loadStyle,
      exerciseName: exercises.name,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      distanceMeters: workoutSets.distanceMeters,
      durationSeconds: workoutSets.durationSeconds,
      comment: workoutSets.comment
    })
    .from(workoutSessions)
    .innerJoin(workoutEntries, eq(workoutEntries.sessionId, workoutSessions.id))
    .innerJoin(workoutSets, eq(workoutSets.entryId, workoutEntries.id))
    .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
    .where(sessionFilterWhere(userId, filter))
    .orderBy(
      asc(workoutSessions.performedOn),
      asc(workoutSessions.startedAt),
      asc(workoutSessions.id),
      asc(workoutEntries.sortOrder),
      asc(workoutEntries.id),
      asc(workoutSets.sortOrder),
      asc(workoutSets.id)
    )
  if (!sets.length) return []

  const sessionIds = [...new Set(sets.map((set) => set.sessionId))]
  const [categories, groups] = await Promise.all([
    loadEntryCategories(userId, sessionIds),
    db
      .select({
        id: workoutEntries.id,
        sessionId: workoutEntries.sessionId,
        supersetGroup: workoutEntries.supersetGroup
      })
      .from(workoutEntries)
      .where(inArray(workoutEntries.sessionId, sessionIds))
      .orderBy(workoutEntries.sessionId, workoutEntries.sortOrder, workoutEntries.id)
  ])
  const categoryName = new Map(categories.map((row) => [row.entryId, row.name]))
  const sessionEntries = new Map<number, typeof groups>()
  for (const entry of groups)
    sessionEntries.set(entry.sessionId, [...(sessionEntries.get(entry.sessionId) ?? []), entry])

  const setNumber = new Map<number, number>()
  const seenSession = new Set<number>()
  return sets.map((set) => {
    const position = (setNumber.get(set.entryId) ?? 0) + 1
    setNumber.set(set.entryId, position)
    const first = !seenSession.has(set.sessionId)
    seenSession.add(set.sessionId)
    const weight = num(set.weight)
    return {
      date: set.performedOn,
      workout: set.sessionName ?? 'Workout',
      exercise: set.exerciseName,
      category: categoryName.get(set.entryId) ?? '',
      set: position,
      weight: weight !== null && set.loadStyle === 'assisted' ? -weight : weight,
      reps: set.reps,
      distanceMeters: num(set.distanceMeters),
      durationSeconds: set.durationSeconds,
      superset: supersetLabel(sessionEntries.get(set.sessionId) ?? [], set.entryId),
      comment: set.comment,
      workoutComment: first ? set.sessionNotes : null
    }
  })
}
