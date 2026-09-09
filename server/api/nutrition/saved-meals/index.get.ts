import { and, eq, isNull } from 'drizzle-orm'
import { savedMeals } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)

  return db
    .select({ id: savedMeals.id, name: savedMeals.name })
    .from(savedMeals)
    .where(and(eq(savedMeals.userId, userId), isNull(savedMeals.deletedAt)))
})
