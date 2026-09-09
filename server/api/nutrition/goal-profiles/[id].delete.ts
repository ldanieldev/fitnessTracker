import { and, eq } from 'drizzle-orm'
import { goalProfiles } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))

  const existing = await db
    .select({ id: goalProfiles.id })
    .from(goalProfiles)
    .where(and(eq(goalProfiles.id, id), eq(goalProfiles.userId, userId)))
    .then((r) => r[0])
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Goal profile not found' })

  await db.update(goalProfiles).set({ deletedAt: new Date(), isDefault: false }).where(eq(goalProfiles.id, id))

  return { ok: true }
})
