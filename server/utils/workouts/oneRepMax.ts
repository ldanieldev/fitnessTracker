import { and, between, count, eq, isNull, ne, or, sql } from 'drizzle-orm'
import type { HistoryStamp, OneRepMaxResult } from '~~/shared/types/workout'
import { bestEstimate, estimateCacheKey, estimateWindowStart } from '~~/shared/utils/oneRepMax'
import { workoutEntries, workoutSessions, workoutSets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadExerciseForUser } from '~~/server/utils/workouts/exercises'

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
      sessionsAt: sql<string | null>`extract(epoch from max(workout_sessions.updated_at))::text`
    })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(ownSetsOf(userId, exerciseId))
    .then((r) => r[0])
  return { sets: row?.sets ?? 0, setsAt: row?.setsAt ?? null, sessionsAt: row?.sessionsAt ?? null }
}

async function computeEstimate(userId: number, exerciseId: number, on: string): Promise<OneRepMaxResult> {
  const rows = await db
    .select({ weight: workoutSets.weight, reps: workoutSets.reps, performedOn: workoutSessions.performedOn })
    .from(workoutSets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutEntries.sessionId))
    .where(and(
      ownSetsOf(userId, exerciseId),
      between(workoutSessions.performedOn, estimateWindowStart(on), on),
      or(isNull(workoutEntries.loadStyle), ne(workoutEntries.loadStyle, 'assisted'))
    ))
  const best = bestEstimate(
    rows.map((row) => ({ weight: row.weight != null ? Number(row.weight) : null, reps: row.reps, performedOn: row.performedOn })),
    on
  )
  return { estimate: best?.estimate ?? null, source: best?.source ?? null, assisted: false }
}

// Built lazily so importing this file never requires Nitro's defineCachedFunction to exist.
let cachedEstimate: ((userId: number, exerciseId: number, on: string, stamp: HistoryStamp) => Promise<OneRepMaxResult>) | undefined

export async function oneRepMaxFor(userId: number, exerciseId: number, on: string): Promise<OneRepMaxResult> {
  const exercise = await loadExerciseForUser(userId, exerciseId)
  if (exercise.loadStyle === 'assisted') return { estimate: null, source: null, assisted: true }
  cachedEstimate ??= defineCachedFunction(
    (user: number, id: number, day: string, _stamp: HistoryStamp) => computeEstimate(user, id, day),
    { name: 'one-rep-max', maxAge: MAX_AGE, swr: false, getKey: estimateCacheKey }
  )
  return cachedEstimate(userId, exerciseId, on, await historyStamp(userId, exerciseId))
}
