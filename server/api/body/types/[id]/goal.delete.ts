import { and, eq } from 'drizzle-orm'
import { measurementGoals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadTypeForUser } from '~~/server/utils/body/types'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const typeId = Number(getRouterParam(event, 'id'))
  await loadTypeForUser(userId, typeId)
  await db.delete(measurementGoals).where(and(eq(measurementGoals.userId, userId), eq(measurementGoals.typeId, typeId)))
  return { ok: true }
})
