import { and, eq, inArray } from 'drizzle-orm'
import type { FitNotesExerciseOption, FitNotesPreview } from '~~/shared/types/fitnotes'
import { workoutSessions } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { listExercisesForUser } from '~~/server/utils/workouts/exercises'
import { exactExerciseMatch, suggestExercises, summarizeFitNotes, type FitNotesRow } from '~~/shared/utils/fitnotes'

export const fitNotesImportKey = (date: string) => `fitnotes:${date}`

export async function exerciseOptions(userId: number): Promise<FitNotesExerciseOption[]> {
  const exercises = await listExercisesForUser(userId)
  return exercises.map((e) => ({ id: e.id, name: e.name, custom: !e.shared }))
}

/** Per export date: whether the app already has a workout there, and whether an earlier import made it. */
export async function sessionDays(userId: number, dates: string[]) {
  const imported = new Set<string>()
  const existing = new Set<string>()
  if (dates.length === 0) return { imported, existing }
  const rows = await db
    .select({ performedOn: workoutSessions.performedOn, importKey: workoutSessions.importKey })
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, userId), inArray(workoutSessions.performedOn, dates)))
  for (const row of rows) {
    if (row.importKey === fitNotesImportKey(row.performedOn)) imported.add(row.performedOn)
    else existing.add(row.performedOn)
  }
  return { imported, existing }
}

export async function previewFitNotes(userId: number, rows: FitNotesRow[]): Promise<FitNotesPreview> {
  const summary = summarizeFitNotes(rows)
  const options = await exerciseOptions(userId)
  const dates = [...new Set(rows.map((r) => r.date))].sort()
  const { imported, existing } = await sessionDays(userId, dates)
  return {
    sets: rows.length,
    days: dates.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    existingDays: [...existing].filter((d) => !imported.has(d)).length,
    importedDays: imported.size,
    exercises: summary.map((s) => {
      const match = exactExerciseMatch(s.name, options)
      return {
        ...s,
        match,
        suggestions: suggestExercises(s.name, options).filter((o) => o.id !== match?.id)
      }
    })
  }
}
