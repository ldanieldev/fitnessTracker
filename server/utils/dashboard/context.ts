import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseQuery } from '~~/server/utils/nutrition/parseBody'
import { calendarDateSchema, isNearServerDate } from '~~/server/utils/validation'
import { todayDate } from '~~/shared/utils/nutritionSummary'

export interface DashboardContext {
  userId: number
  today: string
  weekStart: 0 | 1
  workoutsPerWeek: number
  modules: { body: boolean; workouts: boolean; nutrition: boolean }
}

const todayQuerySchema = z.object({ today: calendarDateSchema.optional() })

export function parseTodayQuery(event: H3Event): string | undefined {
  const { today } = parseQuery(event, todayQuerySchema)
  if (today === undefined) return undefined
  if (!isNearServerDate(today)) {
    throw createError({ statusCode: 400, statusMessage: 'today must be within a day of the server date' })
  }
  return today
}

export async function dashboardContext(userId: number, today?: string): Promise<DashboardContext> {
  const row = await db
    .select({
      weekStart: users.weekStart,
      workoutsPerWeek: users.workoutsPerWeek,
      showBody: users.showBody,
      showWorkouts: users.showWorkouts,
      showNutrition: users.showNutrition
    })
    .from(users)
    .where(eq(users.id, userId))
    .then((r) => r[0])
  return {
    userId,
    today: today ?? todayDate(),
    weekStart: row?.weekStart === 0 ? 0 : 1,
    workoutsPerWeek: row?.workoutsPerWeek ?? 3,
    modules: { body: row?.showBody ?? true, workouts: row?.showWorkouts ?? true, nutrition: row?.showNutrition ?? true }
  }
}
