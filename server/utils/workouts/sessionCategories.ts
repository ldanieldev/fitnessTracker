import { and, eq, inArray, sql } from 'drizzle-orm'
import type { SessionCategoryDot } from '~~/shared/types/workout'
import { exerciseCategories, exerciseCategoryPrefs, exercisePrefs, exercises, workoutEntries } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'

export interface EntryCategory {
  sessionId: number
  entryId: number
  categoryId: number
  name: string
  color: string
}

export async function loadEntryCategories(userId: number, sessionIds: number[]): Promise<EntryCategory[]> {
  if (!sessionIds.length) return []
  return db
    .select({
      sessionId: workoutEntries.sessionId,
      entryId: workoutEntries.id,
      categoryId: exerciseCategories.id,
      // Drizzle strips table qualification in select-field sql fragments, and both tables have name/color.
      name: sql<string>`coalesce(exercise_category_prefs.name, exercise_categories.name)`,
      color: sql<string>`coalesce(exercise_category_prefs.color, exercise_categories.color)`
    })
    .from(workoutEntries)
    .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
    .leftJoin(exercisePrefs, and(eq(exercisePrefs.exerciseId, exercises.id), eq(exercisePrefs.userId, userId)))
    .innerJoin(exerciseCategories, eq(exerciseCategories.id, sql`coalesce(${exercisePrefs.categoryId}, ${exercises.categoryId})`))
    .leftJoin(
      exerciseCategoryPrefs,
      and(eq(exerciseCategoryPrefs.categoryId, exerciseCategories.id), eq(exerciseCategoryPrefs.userId, userId))
    )
    .where(inArray(workoutEntries.sessionId, sessionIds))
    .orderBy(workoutEntries.sessionId, workoutEntries.sortOrder, workoutEntries.id)
}

export function sessionCategoryDots(rows: EntryCategory[]): Map<number, SessionCategoryDot[]> {
  const bySession = new Map<number, SessionCategoryDot[]>()
  for (const row of rows) {
    const dots = bySession.get(row.sessionId) ?? []
    if (!dots.some((dot) => dot.id === row.categoryId)) dots.push({ id: row.categoryId, color: row.color })
    bySession.set(row.sessionId, dots)
  }
  return bySession
}
