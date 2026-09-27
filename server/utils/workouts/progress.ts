import { and, asc, desc, eq, gte, inArray, isNotNull, lte, min, sql } from 'drizzle-orm'
import type {
  ExerciseHistorySession,
  ExerciseRecords,
  ExerciseSeries,
  GraphMetric,
  RecordHighlight,
  RecordKind,
  RepMaxRow,
  WorkoutProgress
} from '~~/shared/types/workout'
import {
  metricLowerIsBetter,
  metricPrecision,
  metricUnit,
  metricValue,
  metricsFor,
  type RollupValues
} from '~~/shared/utils/workoutMetrics'
import { brzycki, REP_MAX_TABLE_REPS, roundTenth } from '~~/shared/utils/oneRepMax'
import { recordsForEarlier } from '~~/shared/utils/workoutRecords'
import { goalReached } from '~~/shared/utils/workoutGoals'
import {
  exerciseMuscles,
  muscles as musclesTable,
  workoutEntries,
  workoutExerciseRollups,
  workoutSessions,
  workoutSets
} from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadExerciseForUser } from '~~/server/utils/workouts/exercises'
import { loadWorkoutGoal, loadWorkoutGoals } from '~~/server/utils/workouts/goals'
import { historyForExercise } from '~~/server/utils/workouts/history'
import { repCapFor, toRollupValues } from '~~/server/utils/workouts/rollups'
import { todayDate } from '~~/shared/utils/nutritionSummary'

interface SeriesQuery {
  metric: GraphMetric
  reps?: number
  from?: string
  to?: string
}

export async function earliestRollup(userId: number, exerciseId?: number): Promise<string | null> {
  const scope = exerciseId === undefined
    ? eq(workoutExerciseRollups.userId, userId)
    : and(eq(workoutExerciseRollups.userId, userId), eq(workoutExerciseRollups.exerciseId, exerciseId))
  const row = await db
    .select({ first: min(workoutExerciseRollups.performedOn) })
    .from(workoutExerciseRollups)
    .where(scope)
    .then((r) => r[0])
  return row?.first ?? null
}

export async function exerciseSeries(userId: number, exerciseId: number, query: SeriesQuery): Promise<ExerciseSeries> {
  const exercise = await loadExerciseForUser(userId, exerciseId)
  if (!metricsFor(exercise.trackingType, exercise.loadStyle).includes(query.metric)) {
    throw createError({ statusCode: 400, statusMessage: 'That metric does not apply to this exercise' })
  }
  if (query.metric === 'weight_at_reps' && query.reps === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'weight_at_reps needs a rep count' })
  }
  const to = query.to ?? todayDate()
  if (query.from && query.from > to) throw createError({ statusCode: 400, statusMessage: 'from must be before to' })
  const from = query.from ?? (await earliestRollup(userId, exerciseId)) ?? to

  const rows = await db
    .select()
    .from(workoutExerciseRollups)
    .where(and(
      eq(workoutExerciseRollups.userId, userId),
      eq(workoutExerciseRollups.exerciseId, exerciseId),
      gte(workoutExerciseRollups.performedOn, from),
      lte(workoutExerciseRollups.performedOn, to)
    ))
    .orderBy(asc(workoutExerciseRollups.performedOn))

  const reps = query.reps ?? null
  const points = rows.flatMap((row) => {
    const value = metricValue(toRollupValues(row), query.metric, reps)
    return value == null ? [] : [{ date: row.performedOn, value }]
  })

  const goal = await loadWorkoutGoal(userId, exerciseId, query.metric)
  const goalApplies = goal !== null && (query.metric !== 'weight_at_reps' || goal.targetReps === reps)

  return {
    metric: query.metric,
    reps,
    unit: metricUnit(query.metric),
    precision: metricPrecision(query.metric),
    from,
    to,
    points,
    goal: goalApplies ? goal : null
  }
}

export async function exerciseRecords(userId: number, exerciseId: number): Promise<ExerciseRecords> {
  const exercise = await loadExerciseForUser(userId, exerciseId)
  const assisted = exercise.loadStyle === 'assisted'
  const [repCap, rows] = await Promise.all([
    repCapFor(userId),
    db
      .select()
      .from(workoutExerciseRollups)
      .where(and(eq(workoutExerciseRollups.userId, userId), eq(workoutExerciseRollups.exerciseId, exerciseId)))
      .orderBy(asc(workoutExerciseRollups.performedOn), asc(workoutExerciseRollups.sessionId))
  ])

  const best = (
    kind: RecordKind,
    pick: (values: RollupValues) => number | null,
    lowerIsBetter = false
  ): RecordHighlight => {
    let hit: { row: typeof rows[number], value: number } | null = null
    for (const row of rows) {
      const value = pick(toRollupValues(row))
      if (value == null) continue
      const better = hit == null || (lowerIsBetter ? value < hit.value : value > hit.value)
      if (better) hit = { row, value }
    }
    return {
      kind,
      value: hit?.value ?? null,
      reps: hit && kind === 'max_weight' ? hit.row.topWeightReps : null,
      performedOn: hit?.row.performedOn ?? null,
      sessionId: hit?.row.sessionId ?? null
    }
  }

  const repMax: RepMaxRow[] = []
  for (let reps = 1; reps <= REP_MAX_TABLE_REPS; reps++) {
    let hit: { row: typeof rows[number], weight: number } | null = null
    for (const row of rows) {
      const weight = row.weightByReps[String(reps)]
      if (weight == null) continue
      const better = hit == null || (assisted ? weight < hit.weight : weight > hit.weight)
      if (better) hit = { row, weight }
    }
    repMax.push({
      reps,
      weight: hit?.weight ?? null,
      performedOn: hit?.row.performedOn ?? null,
      sessionId: hit?.row.sessionId ?? null,
      estimate: hit && !assisted && reps <= repCap ? roundTenth(brzycki(hit.weight, reps)) : null
    })
  }

  return {
    repCap,
    assisted,
    highlights: [
      best('max_weight', (v) => v.topWeight, assisted),
      best('e1rm', (v) => v.bestE1rm),
      best('set_volume', (v) => v.topSetVolume),
      best('session_volume', (v) => v.totalVolume)
    ],
    repMax
  }
}

export async function exerciseHistory(
  userId: number,
  exerciseId: number,
  limit: number
): Promise<ExerciseHistorySession[]> {
  const exercise = await loadExerciseForUser(userId, exerciseId)
  const sessionRows = await db
    .selectDistinct({
      id: workoutSessions.id,
      name: workoutSessions.name,
      performedOn: workoutSessions.performedOn,
      startedAt: workoutSessions.startedAt
    })
    .from(workoutSessions)
    .innerJoin(workoutEntries, eq(workoutEntries.sessionId, workoutSessions.id))
    .innerJoin(workoutSets, eq(workoutSets.entryId, workoutEntries.id))
    .where(and(eq(workoutSessions.userId, userId), eq(workoutEntries.exerciseId, exerciseId)))
    .orderBy(desc(workoutSessions.performedOn), desc(workoutSessions.startedAt), desc(workoutSessions.id))
    .limit(limit)
  if (sessionRows.length === 0) return []

  const sessionIds = sessionRows.map((row) => row.id)
  const [setRows, rollups, history] = await Promise.all([
    db
      .select({
        sessionId: workoutEntries.sessionId,
        trackingType: workoutEntries.trackingType,
        loadStyle: workoutEntries.loadStyle,
        id: workoutSets.id,
        sortOrder: workoutSets.sortOrder,
        weight: workoutSets.weight,
        reps: workoutSets.reps,
        distanceMeters: workoutSets.distanceMeters,
        durationSeconds: workoutSets.durationSeconds,
        done: workoutSets.done,
        comment: workoutSets.comment
      })
      .from(workoutSets)
      .innerJoin(workoutEntries, eq(workoutEntries.id, workoutSets.entryId))
      .where(and(eq(workoutEntries.exerciseId, exerciseId), inArray(workoutEntries.sessionId, sessionIds)))
      .orderBy(asc(workoutEntries.sortOrder), asc(workoutSets.sortOrder), asc(workoutSets.id)),
    db
      .select()
      .from(workoutExerciseRollups)
      .where(and(
        eq(workoutExerciseRollups.userId, userId),
        eq(workoutExerciseRollups.exerciseId, exerciseId),
        inArray(workoutExerciseRollups.sessionId, sessionIds)
      )),
    historyForExercise(userId, exerciseId)
  ])

  const rollupBySession = new Map(rollups.map((row) => [row.sessionId, toRollupValues(row)]))
  return sessionRows.map((session) => {
    const values = rollupBySession.get(session.id)
    const rows = setRows.filter((row) => row.sessionId === session.id)
    return {
      sessionId: session.id,
      performedOn: session.performedOn,
      name: session.name,
      trackingType: rows[0]?.trackingType ?? exercise.trackingType,
      loadStyle: rows[0]?.loadStyle ?? exercise.loadStyle,
      sets: rows.map((row) => ({
        id: row.id,
        sortOrder: row.sortOrder,
        weight: row.weight != null ? Number(row.weight) : null,
        reps: row.reps,
        distanceMeters: row.distanceMeters != null ? Number(row.distanceMeters) : null,
        durationSeconds: row.durationSeconds,
        done: row.done,
        comment: row.comment,
        records: recordsForEarlier(history, row.id, row.trackingType, row.loadStyle)
      })),
      totals: {
        sets: values?.setCount ?? rows.length,
        volume: values?.totalVolume ?? null,
        topWeight: values?.topWeight ?? null,
        topWeightReps: values?.topWeightReps ?? null
      }
    }
  })
}

export async function workoutProgress(userId: number, from: string, to: string): Promise<WorkoutProgress> {
  if (from > to) throw createError({ statusCode: 400, statusMessage: 'from must be before to' })
  const inRange = and(
    eq(workoutExerciseRollups.userId, userId),
    gte(workoutExerciseRollups.performedOn, from),
    lte(workoutExerciseRollups.performedOn, to)
  )

  const [totals, duration, muscles, goals] = await Promise.all([
    db
      .select({
        workouts: sql<number>`count(distinct ${workoutExerciseRollups.sessionId})`.mapWith(Number),
        sets: sql<number>`coalesce(sum(${workoutExerciseRollups.setCount}), 0)`.mapWith(Number),
        reps: sql<number>`coalesce(sum(${workoutExerciseRollups.totalReps}), 0)`.mapWith(Number),
        volume: sql<number>`coalesce(sum(${workoutExerciseRollups.totalVolume}), 0)`.mapWith(Number)
      })
      .from(workoutExerciseRollups)
      .where(inRange)
      .then((r) => r[0]!),
    db
      .select({
        seconds: sql<number>`coalesce(sum(extract(epoch from
          (${workoutSessions.endedAt} - ${workoutSessions.startedAt}))), 0)`.mapWith(Number)
      })
      .from(workoutSessions)
      .where(and(
        eq(workoutSessions.userId, userId),
        gte(workoutSessions.performedOn, from),
        lte(workoutSessions.performedOn, to),
        isNotNull(workoutSessions.endedAt)
      ))
      .then((r) => r[0]!),
    db
      .select({
        key: musclesTable.key,
        name: musclesTable.name,
        volume: sql<number>`coalesce(sum(${workoutExerciseRollups.totalVolume}), 0)`.mapWith(Number),
        sets: sql<number>`coalesce(sum(${workoutExerciseRollups.setCount}), 0)`.mapWith(Number)
      })
      .from(workoutExerciseRollups)
      .innerJoin(exerciseMuscles, and(
        eq(exerciseMuscles.exerciseId, workoutExerciseRollups.exerciseId),
        eq(exerciseMuscles.isPrimary, true)
      ))
      .innerJoin(musclesTable, eq(musclesTable.id, exerciseMuscles.muscleId))
      .where(inRange)
      .groupBy(musclesTable.key, musclesTable.name)
      .orderBy(desc(sql`coalesce(sum(${workoutExerciseRollups.totalVolume}), 0)`)),
    loadWorkoutGoals(userId)
  ])

  const goalExerciseIds = [...new Set(goals.map((goal) => goal.exerciseId))]
  const goalRows = goalExerciseIds.length
    ? await db
        .select()
        .from(workoutExerciseRollups)
        .where(and(
          eq(workoutExerciseRollups.userId, userId),
          inArray(workoutExerciseRollups.exerciseId, goalExerciseIds)
        ))
    : []

  return {
    from,
    to,
    totals: {
      workouts: totals.workouts,
      sets: totals.sets,
      reps: totals.reps,
      volume: totals.volume,
      durationSeconds: Math.round(duration.seconds)
    },
    muscles,
    goals: goals.map((goal) => {
      const rows = goalRows.filter((row) => row.exerciseId === goal.exerciseId)
      const lowerIsBetter = metricLowerIsBetter(goal.metric, rows[0]?.loadStyle ?? null)
      const values = rows
        .map((row) => metricValue(toRollupValues(row), goal.metric, goal.targetReps))
        .filter((value): value is number => value != null)
      const current = values.length ? (lowerIsBetter ? Math.min(...values) : Math.max(...values)) : null
      return {
        ...goal,
        current,
        lowerIsBetter,
        reached: goal.achievedAt != null || goalReached(current, goal.targetValue, lowerIsBetter)
      }
    })
  }
}
