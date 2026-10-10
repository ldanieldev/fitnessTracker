import { and, eq } from 'drizzle-orm'
import { stepDays } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { parseStepDate } from '~~/server/utils/body/steps'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const day = parseStepDate(getRouterParam(event, 'date'))
  await db.delete(stepDays).where(and(eq(stepDays.userId, userId), eq(stepDays.day, day)))
  return { ok: true }
})
