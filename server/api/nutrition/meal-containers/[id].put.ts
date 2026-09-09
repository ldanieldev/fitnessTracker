import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { mealContainers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { containerColumns } from '~~/server/utils/nutrition/containerColumns'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'
import { isUniqueViolation } from '~~/server/utils/pgError'

const containerSchema = z.object({
  name: z.string().min(1).max(64),
  sortOrder: z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await parseBody(event, containerSchema)

  const existing = await db
    .select({ id: mealContainers.id })
    .from(mealContainers)
    .where(and(eq(mealContainers.id, id), eq(mealContainers.userId, userId)))
    .then((r) => r[0])
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Container not found' })

  const patch = body.sortOrder !== undefined
    ? { name: body.name, sortOrder: body.sortOrder }
    : { name: body.name }

  try {
    return await db
      .update(mealContainers)
      .set(patch)
      .where(eq(mealContainers.id, id))
      .returning(containerColumns)
      .then((r) => r[0]!)
  } catch (err) {
    if (isUniqueViolation(err, 'meal_container_user_name_unique')) {
      throw createError({ statusCode: 409, statusMessage: 'Container name already in use' })
    }
    throw err
  }
})
