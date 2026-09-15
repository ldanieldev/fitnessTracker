import { and, eq } from 'drizzle-orm'
import { foodServings } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadEditableFood } from '~~/server/utils/nutrition/loadEditableFood'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { assertCanDeleteServing, ServingInUseError } from '~~/server/utils/nutrition/servingGuards'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = Number(getRouterParam(event, 'id'))
  const servingId = Number(getRouterParam(event, 'servingId'))

  const food = await loadEditableFood(db, userId, foodId)

  try {
    assertCanDeleteServing(food, servingId)
  } catch (err) {
    if (err instanceof ServingInUseError) {
      throw createError({ statusCode: 409, statusMessage: err.message })
    }
    throw createError({ statusCode: 404, statusMessage: 'Serving not found' })
  }

  await db.transaction(async (tx) => {
    await tx
      .update(foodServings)
      .set({ deletedAt: new Date() })
      .where(and(eq(foodServings.id, servingId), eq(foodServings.foodId, foodId)))
    await enqueueSearchOutbox(tx, foodId, 'upsert')
  })

  return { ok: true }
})
