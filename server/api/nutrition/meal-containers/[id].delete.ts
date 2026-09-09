import { and, eq } from 'drizzle-orm'
import { mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))

  const existing = await db
    .select({ id: mealContainers.id })
    .from(mealContainers)
    .where(and(eq(mealContainers.id, id), eq(mealContainers.userId, userId)))
    .then((r) => r[0])
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Container not found' })

  await db.update(mealContainers).set({ isArchived: true }).where(eq(mealContainers.id, id))

  return { ok: true }
})
