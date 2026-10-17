import { eq } from 'drizzle-orm'
import { measurementTypes } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadTypeForUser } from '~~/server/utils/body/types'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)
  const existing = await loadTypeForUser(userId, id)
  if (existing.userId === null)
    throw createError({ statusCode: 403, statusMessage: 'Built-in measurements cannot be deleted' })
  await db.update(measurementTypes).set({ deletedAt: new Date() }).where(eq(measurementTypes.id, id))
  return { ok: true }
})
