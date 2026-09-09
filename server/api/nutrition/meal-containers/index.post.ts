import { eq, max } from 'drizzle-orm'
import { z } from 'zod'
import { mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { containerColumns } from '~~/server/utils/nutrition/containerColumns'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'
import { isUniqueViolation } from '~~/server/utils/pgError'

const containerSchema = z.object({
  name: z.string().min(1).max(64)
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, containerSchema)

  const highest = await db
    .select({ max: max(mealContainers.sortOrder) })
    .from(mealContainers)
    .where(eq(mealContainers.userId, userId))
    .then((r) => r[0]?.max ?? -1)

  try {
    return await db
      .insert(mealContainers)
      .values({ userId, name: body.name, sortOrder: highest + 1 })
      .returning(containerColumns)
      .then((r) => r[0]!)
  } catch (err) {
    if (isUniqueViolation(err, 'meal_container_user_name_unique')) {
      throw createError({ statusCode: 409, statusMessage: 'Container name already in use' })
    }
    throw err
  }
})
