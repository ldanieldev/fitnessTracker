import { and, asc, eq, isNotNull, lte } from 'drizzle-orm'
import type { Consistency, ProgramWindow } from '~~/shared/types/dashboard'
import { workoutSessions } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { cachedPart } from '~~/server/utils/dashboard/cache'
import type { DashboardContext } from '~~/server/utils/dashboard/context'
import { consistencyStamp } from '~~/server/utils/dashboard/stamps'
import { loadEnrollment } from '~~/server/utils/workouts/enrollments'
import {
  calendarWeekStarts,
  CALENDAR_WEEKS,
  countByWeek,
  longestRun,
  weekMet,
  weekStreak,
  weekTarget
} from '~~/shared/utils/dashboard'
import { shiftDate } from '~~/shared/utils/nutritionSummary'
import { weekStartOf } from '~~/shared/utils/programs'

async function finishedDays(userId: number, today: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: workoutSessions.performedOn })
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, userId),
        isNotNull(workoutSessions.endedAt),
        lte(workoutSessions.performedOn, today)
      )
    )
    .orderBy(asc(workoutSessions.performedOn))
  return rows.map((r) => r.date)
}

async function programWindow(ctx: DashboardContext, currentWeekStart: string): Promise<ProgramWindow | null> {
  const enrollment = await loadEnrollment(ctx.userId, ctx.today)
  if (!enrollment || enrollment.state !== 'current') return null
  return {
    week: enrollment.week,
    currentWeekStart,
    phases: enrollment.phases.map((p) => ({
      weeks: p.weeks,
      deload: p.deload,
      routine: p.routine ? { dayCount: p.routine.dayCount } : null
    }))
  }
}

export async function loadConsistency(ctx: DashboardContext): Promise<Consistency> {
  const currentWeekStart = weekStartOf(ctx.today, ctx.weekStart)
  const program = await programWindow(ctx, currentWeekStart)
  const stamp = async () => ({ sessions: await consistencyStamp(ctx.userId), program, setting: ctx.workoutsPerWeek })
  return cachedPart('consistency', ctx, stamp, async () => {
    const days = await finishedDays(ctx.userId, ctx.today)
    const calendarStarts = calendarWeekStarts(ctx.today, ctx.weekStart)
    const historyStart = days[0] ? weekStartOf(days[0], ctx.weekStart) : currentWeekStart
    const first = historyStart < calendarStarts[0]! ? historyStart : calendarStarts[0]!
    const counts = countByWeek(days, ctx.weekStart)
    const weeks = []
    for (let start = first; start <= currentWeekStart; start = shiftDate(start, 7)) {
      const { target, source } = weekTarget(start, program, ctx.workoutsPerWeek)
      const count = counts.get(start) ?? 0
      const met = weekMet(count, target, start === currentWeekStart, days.length === 0 || start < historyStart)
      weeks.push({ start, target, count, met, source })
    }
    const mets = weeks.map((w) => w.met)
    const current = weeks.at(-1)!
    return {
      weekStart: ctx.weekStart,
      weeks: weeks
        .slice(-CALENDAR_WEEKS)
        .map((w) => ({ start: w.start, target: w.target, count: w.count, met: w.met })),
      days: days.filter((d) => d >= calendarStarts[0]!),
      streak: weekStreak(mets),
      best: longestRun(mets),
      thisWeek: { count: current.count, target: current.target },
      targetSource: current.source
    }
  })
}
