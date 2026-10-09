import { and, between, count, eq, gt, isNull, ne, or, sql } from 'drizzle-orm'
import type { HistoryStamp, OneRepMaxResult } from '~~/shared/types/workout'
import { bestEstimate, estimateCacheKey, estimateWindowStart, historyStampKey } from '~~/shared/utils/oneRepMax'
import { workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { readStamped, type StampedEntry } from '~~/server/utils/cache/stampedCache'
import { db } from '~~/server/utils/db'
import { loadExerciseSettings } from '~~/server/utils/workouts/exercises'
import { repCapFor } from '~~/server/utils/workouts/rollups'

const MAX_AGE = 60 * 60 * 24

function ownSetsOf(userId: number, exerciseId: number) {
  return and(eq(workoutSessions.userId, userId), eq(workoutEntries.exerciseId, exerciseId))
}

// Raw column names: Drizzle strips table qualification inside select-field fragments, and both tables have updated_at.
async function historyStamp(userId: number, exerciseId: number): Promise<HistoryStamp> {
  const row = await db
    .select({
      sets: count(workoutSets.id),
      setsAt: sql<string | null>`extract(epoch from max(workout_sets.updated_at))::text`,
      sessionsAt: sql<string | null>`extract(epoch from max(workout_sessions.updated_at))::text`,
      entriesAt: sql<string | null>`extract(epoch from max(workout_entries.updated_at))::text`
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(ownSetsOf(userId, exerciseId))
    .then((r) => r[0])
  return { sets: row?.sets ?? 0, setsAt: row?.setsAt ?? null, sessionsAt: row?.sessionsAt ?? null, entriesAt: row?.entriesAt ?? null }
}

async function computeEstimate(
  userId: number,
  exerciseId: number,
  on: string,
  repCap: number
): Promise<OneRepMaxResult> {
  const rows = await db
    .select({ weight: workoutSets.weight, reps: workoutSets.reps, performedOn: workoutSessions.performedOn })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(and(
      ownSetsOf(userId, exerciseId),
      between(workoutSessions.performedOn, estimateWindowStart(on), on),
      gt(workoutSets.weight, '0'),
      between(workoutSets.reps, 1, repCap),
      or(isNull(workoutEntries.loadStyle), ne(workoutEntries.loadStyle, 'assisted'))
    ))
  const best = bestEstimate(
    rows.map((row) => (
      { weight: row.weight != null ? Number(row.weight) : null, reps: row.reps, performedOn: row.performedOn }
    )),
    on,
    repCap
  )
  return { estimate: best?.estimate ?? null, source: best?.source ?? null, assisted: false }
}

export async function oneRepMaxFor(userId: number, exerciseId: number, on: string): Promise<OneRepMaxResult> {
  const exercise = await loadExerciseSettings(userId, exerciseId)
  if (exercise.loadStyle === 'assisted') return { estimate: null, source: null, assisted: true }
  const repCap = await repCapFor(userId)
  const stamp = historyStampKey(await historyStamp(userId, exerciseId))
  const storage = useStorage('cache')
  return readStamped<OneRepMaxResult>(
    {
      get: (key) => storage.getItem<StampedEntry<OneRepMaxResult>>(key),
      set: (key, entry, ttl) => storage.setItem(key, entry, { ttl })
    },
    estimateCacheKey(userId, exerciseId, on, repCap),
    stamp,
    MAX_AGE,
    () => computeEstimate(userId, exerciseId, on, repCap)
  )
}
