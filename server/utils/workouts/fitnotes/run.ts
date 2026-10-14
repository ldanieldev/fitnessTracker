import { and, eq, isNull, sql } from 'drizzle-orm'
import type { FitNotesImportResult, FitNotesMapping } from '~~/shared/types/fitnotes'
import type { LoadStyle, TrackingType } from '~~/shared/types/workout'
import {
  exerciseCategories,
  exercises,
  importJobs,
  workoutEntries,
  workoutSessions,
  workoutSets
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { isUniqueViolation } from '~~/server/utils/pgError'
import { listCategoriesForUser } from '~~/server/utils/workouts/categories'
import { insertExercise } from '~~/server/utils/workouts/exerciseWrites'
import { loadExerciseSettings } from '~~/server/utils/workouts/exercises'
import { rebuildRollups } from '~~/server/utils/workouts/rollups'
import {
  exactExerciseMatch,
  fitNotesCategoryKey,
  parseFitNotesCsv,
  planFitNotesDays,
  setWeight,
  summarizeFitNotes,
  type FitNotesExerciseSummary
} from '~~/shared/utils/fitnotes'
import type { FitNotesImportPayload } from './input'
import { exerciseOptions, fitNotesImportKey, sessionDays } from './preview'

const IMPORT_CATEGORY_COLOR = 'slate'
const COMMENT_MAX = 500

interface TargetExercise {
  id: number
  trackingType: TrackingType
  loadStyle: LoadStyle | null
}

async function ownExerciseNamed(userId: number, name: string): Promise<number | null> {
  return db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        eq(exercises.createdByUserId, userId),
        isNull(exercises.deletedAt),
        sql`lower(${exercises.name}) = lower(${name})`
      )
    )
    .then((r) => r[0]?.id ?? null)
}

// Category resolution: a FitNotes default maps to a shared category by key, anything else to a same-named category.
async function categoryResolver(userId: number) {
  const categories = await listCategoriesForUser(userId, { includeHidden: true })
  const byKey = new Map(categories.filter((c) => c.key).map((c) => [c.key!, c.id]))
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))
  let created = 0
  const resolve = async (category: string): Promise<number> => {
    const key = fitNotesCategoryKey(category)
    const hit = (key ? byKey.get(key) : undefined) ?? byName.get(category.trim().toLowerCase())
    if (hit !== undefined) return hit
    const name = category.trim() || 'FitNotes'
    const sortOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1 + created
    const row = await db
      .insert(exerciseCategories)
      .values({ userId, name, color: IMPORT_CATEGORY_COLOR, sortOrder })
      .returning({ id: exerciseCategories.id })
      .then((r) => r[0]!)
    created++
    byName.set(name.toLowerCase(), row.id)
    return row.id
  }
  return { resolve, created: () => created }
}

async function resolveExercises(
  userId: number,
  summary: FitNotesExerciseSummary[],
  mapping: FitNotesMapping
): Promise<{ targets: Map<string, TargetExercise>; exercisesCreated: number; categoriesCreated: number }> {
  const categories = await categoryResolver(userId)
  const options = await exerciseOptions(userId)
  const targets = new Map<string, TargetExercise>()
  let exercisesCreated = 0
  for (const s of summary) {
    const loadStyle = s.assisted ? 'assisted' : null
    // Omitted names take the same exact match the preview showed; only an explicit null asks for a new exercise.
    const mapped = s.name in mapping ? mapping[s.name] : (exactExerciseMatch(s.name, options)?.id ?? null)
    if (mapped != null) {
      const exercise = await loadExerciseSettings(userId, mapped)
      targets.set(s.name, { id: mapped, trackingType: s.trackingType, loadStyle: loadStyle ?? exercise.loadStyle })
      continue
    }
    let id = await ownExerciseNamed(userId, s.name)
    if (id === null) {
      const categoryId = await categories.resolve(s.category)
      id = await db.transaction((tx) =>
        insertExercise(tx, userId, {
          name: s.name,
          categoryId,
          trackingType: s.trackingType,
          loadStyle,
          equipment: [],
          primaryMuscles: [],
          secondaryMuscles: []
        })
      )
      exercisesCreated++
    }
    targets.set(s.name, { id, trackingType: s.trackingType, loadStyle })
  }
  return { targets, exercisesCreated, categoriesCreated: categories.created() }
}

export async function performFitNotesImport(
  userId: number,
  payload: FitNotesImportPayload
): Promise<FitNotesImportResult> {
  const rows = parseFitNotesCsv(payload.csv)
  const summary = summarizeFitNotes(rows)
  const { targets, exercisesCreated, categoriesCreated } = await resolveExercises(userId, summary, payload.mapping)
  const days = planFitNotesDays(rows)
  const { imported, existing } = await sessionDays(
    userId,
    days.map((d) => d.date)
  )

  const result: FitNotesImportResult = {
    daysImported: 0,
    daysSkippedImported: 0,
    daysSkippedExisting: 0,
    sets: 0,
    exercisesCreated,
    categoriesCreated
  }

  for (const day of days) {
    if (imported.has(day.date)) {
      result.daysSkippedImported++
      continue
    }
    if (payload.skipExistingDays && existing.has(day.date)) {
      result.daysSkippedExisting++
      continue
    }
    // Noon UTC keeps the calendar date in any timezone; equal start and end mean "no duration recorded".
    const at = new Date(`${day.date}T12:00:00Z`)
    try {
      const sets = await db.transaction(async (tx) => {
        const session = await tx
          .insert(workoutSessions)
          .values({
            userId,
            performedOn: day.date,
            startedAt: at,
            endedAt: at,
            importKey: fitNotesImportKey(day.date)
          })
          .returning({ id: workoutSessions.id })
          .then((r) => r[0]!)
        let count = 0
        for (const [sortOrder, entry] of day.entries.entries()) {
          const target = targets.get(entry.exercise)!
          const assisted = target.loadStyle === 'assisted'
          const row = await tx
            .insert(workoutEntries)
            .values({
              sessionId: session.id,
              exerciseId: target.id,
              sortOrder,
              trackingType: target.trackingType,
              loadStyle: target.loadStyle
            })
            .returning({ id: workoutEntries.id })
            .then((r) => r[0]!)
          await tx.insert(workoutSets).values(
            entry.sets.map((set, index) => {
              const weight = setWeight(set, target.trackingType, assisted)
              return {
                entryId: row.id,
                sortOrder: index,
                weight: weight === null ? null : String(weight),
                reps: target.trackingType.includes('reps') ? set.reps : null,
                distanceMeters: set.distanceMeters === null ? null : String(set.distanceMeters),
                durationSeconds: set.durationSeconds,
                done: true,
                comment: set.comment?.slice(0, COMMENT_MAX) ?? null
              }
            })
          )
          count += entry.sets.length
        }
        return count
      })
      result.daysImported++
      result.sets += sets
    } catch (err) {
      // A concurrent import of the same file got this date first.
      if (!isUniqueViolation(err, 'workout_session_import_key')) throw err
      result.daysSkippedImported++
    }
  }

  if (result.daysImported > 0) await rebuildRollups(userId)
  return result
}

export async function runFitNotesImport(jobId: number): Promise<FitNotesImportResult> {
  const job = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.source, 'fitnotes')))
    .then((r) => r[0])
  if (!job) throw new Error(`FitNotes import job ${jobId} not found`)

  await db.update(importJobs).set({ status: 'running' }).where(eq(importJobs.id, jobId))
  try {
    const result = await performFitNotesImport(job.userId, job.payload as FitNotesImportPayload)
    await db.update(importJobs).set({ status: 'done', result }).where(eq(importJobs.id, jobId))
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.update(importJobs).set({ status: 'failed', error: message }).where(eq(importJobs.id, jobId))
    throw err
  }
}
