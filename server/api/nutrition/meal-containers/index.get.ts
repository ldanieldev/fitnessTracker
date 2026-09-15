import { and, asc, count, eq } from 'drizzle-orm'
import { mealContainers } from '~~/server/db/schema'
import { seedContainersForUser } from '~~/server/db/seed/nutrition'
import { db } from '~~/server/utils/db'
import { containerColumns } from '~~/server/utils/nutrition/containerColumns'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const query = getQuery(event)
  const includeArchived = query.includeArchived === '1'

  const existingCount = await db
    .select({ count: count() })
    .from(mealContainers)
    .where(eq(mealContainers.userId, userId))
    .then((r) => r[0]!.count)

  if (existingCount === 0) {
    await seedContainersForUser(userId)
  }

  const rows = await db
    .select(containerColumns)
    .from(mealContainers)
    .where(
      includeArchived
        ? eq(mealContainers.userId, userId)
        : and(eq(mealContainers.userId, userId), eq(mealContainers.isArchived, false))
    )
    .orderBy(asc(mealContainers.sortOrder))

  return rows
})
