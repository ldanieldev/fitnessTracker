import { asc, eq } from 'drizzle-orm'
import type { NutritionStreak } from '~~/shared/types/dashboard'
import { diaryDays, diaryEntries } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { cachedPart } from '~~/server/utils/dashboard/cache'
import type { DashboardContext } from '~~/server/utils/dashboard/context'
import { nutritionStamp } from '~~/server/utils/dashboard/stamps'
import { calendarWeekStarts, dayStreak, longestDayRun } from '~~/shared/utils/dashboard'
import { shiftDate } from '~~/shared/utils/nutritionSummary'
import { weekStartOf } from '~~/shared/utils/programs'

// Joins entries: diary_days rows also exist for days with only a goal profile or meal time and no food.
async function loggedDays(userId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: diaryDays.date })
    .from(diaryDays)
    .innerJoin(diaryEntries, eq(diaryEntries.dayId, diaryDays.id))
    .where(eq(diaryDays.userId, userId))
    .orderBy(asc(diaryDays.date))
  return rows.map((r) => r.date)
}

export async function loadNutrition(ctx: DashboardContext): Promise<NutritionStreak> {
  return cachedPart('nutrition', ctx, () => nutritionStamp(ctx.userId), async () => {
    const all = (await loggedDays(ctx.userId)).filter((d) => d <= ctx.today)
    const windowStart = calendarWeekStarts(ctx.today, ctx.weekStart)[0]!
    const thisWeek = weekStartOf(ctx.today, ctx.weekStart)
    const lastWeek = shiftDate(thisWeek, -7)
    return {
      weekStart: ctx.weekStart,
      days: all.filter((d) => d >= windowStart),
      streak: dayStreak(all, ctx.today),
      best: longestDayRun(all),
      lastWeek: all.filter((d) => d >= lastWeek && d < thisWeek).length
    }
  })
}
