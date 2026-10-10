import { and, eq } from 'drizzle-orm'
import type { StepDay } from '~~/shared/types/steps'
import { stepDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { isoDate } from '~~/server/utils/body/input'
import { parseWith } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event): Promise<{ day: StepDay | null }> => {
  const userId = await requireUserId(event)
  const day = parseWith(isoDate, getRouterParam(event, 'date'))
  const row = await db
    .select({ date: stepDays.day, steps: stepDays.steps })
    .from(stepDays)
    .where(and(eq(stepDays.userId, userId), eq(stepDays.day, day)))
    .then((r) => r[0] ?? null)
  return { day: row }
})
