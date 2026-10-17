import { eq } from 'drizzle-orm'
import { foods } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadEditableFood } from '~~/server/utils/nutrition/loadEditableFood'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { requireUserId } from '~~/server/utils/session'
import { routeId } from '~~/server/utils/validation'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = routeId(event)

  await loadEditableFood(db, userId, id)

  await db.transaction(async (tx) => {
    await tx.update(foods).set({ deletedAt: new Date() }).where(eq(foods.id, id))
    await enqueueSearchOutbox(tx, id, 'delete')
  })

  return { ok: true }
})
