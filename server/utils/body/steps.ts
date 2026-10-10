import { and, eq, gte, lte, min } from 'drizzle-orm'
import type { StepDay, StepTarget, StepWeek } from '~~/shared/types/steps'
import { stepDays, stepTargets } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { isoDate } from '~~/server/utils/body/input'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { shiftDate, todayDate } from '~~/shared/utils/nutritionSummary'
import { weekStartOf } from '~~/shared/utils/programs'
import { summarizeWeek } from '~~/shared/utils/steps'

export function parseStepDate(raw: string | undefined): string {
  const date = parseWith(isoDate, raw)
  // The day comes from the client's clock, which can run up to a day ahead of the server's (UTC in the container).
  if (date > shiftDate(todayDate(), 1)) {
    throw createError({ statusCode: 400, statusMessage: 'Steps can’t be logged for a future day' })
  }
  return date
}

export async function loadStepTargets(userId: number): Promise<StepTarget[]> {
  return db
    .select({ dailyTarget: stepTargets.dailyTarget, effectiveFrom: stepTargets.effectiveFrom })
    .from(stepTargets)
    .where(eq(stepTargets.userId, userId))
}

export async function loadStepWeeks(
  userId: number,
  weekStart: 0 | 1,
  today: string,
  count: number
): Promise<StepWeek[]> {
  const newest = weekStartOf(today, weekStart)
  const first = await db
    .select({ day: min(stepDays.day) })
    .from(stepDays)
    .where(eq(stepDays.userId, userId))
    .then((r) => r[0]?.day ?? null)
  const floor = first ? weekStartOf(first, weekStart) : newest

  const starts = [newest]
  while (starts.length < count) {
    const next = shiftDate(starts[starts.length - 1]!, -7)
    if (next < floor) break
    starts.push(next)
  }

  const rows: StepDay[] = await db
    .select({ date: stepDays.day, steps: stepDays.steps })
    .from(stepDays)
    .where(
      and(
        eq(stepDays.userId, userId),
        gte(stepDays.day, starts[starts.length - 1]!),
        lte(stepDays.day, shiftDate(newest, 6))
      )
    )
  const byWeek = new Map<string, StepDay[]>()
  for (const row of rows) {
    const key = weekStartOf(row.date, weekStart)
    byWeek.set(key, [...(byWeek.get(key) ?? []), row])
  }
  const targets = await loadStepTargets(userId)
  return starts.map((start) => summarizeWeek(start, byWeek.get(start) ?? [], targets, today))
}
