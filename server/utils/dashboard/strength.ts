import { and, asc, between, eq, isNotNull, isNull } from 'drizzle-orm'
import type { GraphMetric } from '~~/shared/types/workout'
import type { LiftPoint, Strength, StrengthLift } from '~~/shared/types/dashboard'
import { exercises, workoutExerciseGoals, workoutExerciseRollups, workoutSessions } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { cachedPart } from '~~/server/utils/dashboard/cache'
import type { DashboardContext } from '~~/server/utils/dashboard/context'
import { goalsStamp, workoutsStamp } from '~~/server/utils/dashboard/stamps'
import { repCapFor, toRollupValues } from '~~/server/utils/workouts/rollups'
import { CALENDAR_WEEKS, liftGoalProgress, liftStats, rankTrained } from '~~/shared/utils/dashboard'
import { shiftDate } from '~~/shared/utils/nutritionSummary'
import { metricLowerIsBetter, metricUnit, metricValue } from '~~/shared/utils/workoutMetrics'

const MAX_LIFTS = 3
const TRAINED_DAYS = 56

type RollupRow = typeof workoutExerciseRollups.$inferSelect & { name: string }

async function windowRollups(userId: number, from: string, to: string): Promise<RollupRow[]> {
  const rows = await db
    .select({ rollup: workoutExerciseRollups, name: exercises.name })
    .from(workoutExerciseRollups)
    .innerJoin(workoutSessions, eq(workoutSessions.id, workoutExerciseRollups.sessionId))
    .innerJoin(exercises, eq(exercises.id, workoutExerciseRollups.exerciseId))
    .where(
      and(
        eq(workoutExerciseRollups.userId, userId),
        isNotNull(workoutSessions.endedAt),
        isNull(exercises.deletedAt),
        between(workoutExerciseRollups.performedOn, from, to)
      )
    )
    .orderBy(asc(workoutExerciseRollups.performedOn))
  return rows.map((r) => ({ ...r.rollup, name: r.name }))
}

async function goals(userId: number) {
  return db
    .select({
      exerciseId: workoutExerciseGoals.exerciseId,
      metric: workoutExerciseGoals.metric,
      targetValue: workoutExerciseGoals.targetValue,
      targetReps: workoutExerciseGoals.targetReps
    })
    .from(workoutExerciseGoals)
    .innerJoin(exercises, eq(exercises.id, workoutExerciseGoals.exerciseId))
    .where(and(eq(workoutExerciseGoals.userId, userId), isNull(exercises.deletedAt)))
    .orderBy(
      asc(workoutExerciseGoals.createdAt),
      asc(workoutExerciseGoals.exerciseId),
      asc(workoutExerciseGoals.metric)
    )
}

function lift(
  rows: RollupRow[],
  today: string,
  metric: GraphMetric,
  goal: { targetValue: number; targetReps: number | null } | null
): StrengthLift | null {
  if (!rows.length) return null
  const points: LiftPoint[] = rows.flatMap((row) => {
    const value = metricValue(toRollupValues(row), metric, goal?.targetReps ?? null)
    return value === null ? [] : [{ date: row.performedOn, value }]
  })
  const lowerIsBetter = metricLowerIsBetter(metric, rows.at(-1)!.loadStyle)
  const stats = liftStats(points, today, lowerIsBetter)
  if (!stats) return null
  return {
    exerciseId: rows[0]!.exerciseId,
    name: rows[0]!.name,
    metric,
    unit: metricUnit(metric),
    lowerIsBetter,
    ...stats,
    goal: goal
      ? {
          ...goal,
          progress: liftGoalProgress(stats.series[0] ?? stats.value, stats.value, goal.targetValue, lowerIsBetter)
        }
      : null
  }
}

export async function loadStrength(ctx: DashboardContext): Promise<Strength> {
  const from = shiftDate(ctx.today, -(CALENDAR_WEEKS * 7 - 1))
  const window = { from, to: ctx.today }
  const stamp = () => Promise.all([workoutsStamp(ctx.userId, window), goalsStamp(ctx.userId), repCapFor(ctx.userId)])
  return cachedPart('strength', ctx, stamp, async () => {
    const [rows, goalRows] = await Promise.all([windowRollups(ctx.userId, from, ctx.today), goals(ctx.userId)])
    const byExercise = new Map<number, RollupRow[]>()
    for (const row of rows) byExercise.set(row.exerciseId, [...(byExercise.get(row.exerciseId) ?? []), row])

    const lifts: StrengthLift[] = []
    const chosen = new Set<number>()
    for (const g of goalRows) {
      if (lifts.length === MAX_LIFTS || chosen.has(g.exerciseId)) continue
      const goal = { targetValue: Number(g.targetValue), targetReps: g.targetReps }
      const picked = lift(byExercise.get(g.exerciseId) ?? [], ctx.today, g.metric, goal)
      if (!picked) continue
      chosen.add(g.exerciseId)
      lifts.push(picked)
    }

    const recentFrom = shiftDate(ctx.today, -(TRAINED_DAYS - 1))
    const trained = [...byExercise.entries()].flatMap(([exerciseId, list]) => {
      const recent = list.filter(
        (r) => r.performedOn >= recentFrom && r.trackingType === 'weight_reps' && r.loadStyle !== 'assisted'
      )
      if (!recent.length) return []
      return [{ exerciseId, name: list[0]!.name, sessions: new Set(recent.map((r) => r.sessionId)).size }]
    })
    for (const t of rankTrained(trained)) {
      if (lifts.length === MAX_LIFTS) break
      if (chosen.has(t.exerciseId)) continue
      const rows = byExercise.get(t.exerciseId)!
      const picked = lift(rows, ctx.today, 'e1rm', null) ?? lift(rows, ctx.today, 'max_weight', null)
      if (picked) lifts.push(picked)
    }
    return { lifts }
  })
}
