import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { foods } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadEditableFood } from '~~/server/utils/nutrition/loadEditableFood'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { requireUserId } from '~~/server/utils/session'

const foodUpdateSchema = z.object({
  name: z.string().min(1).max(255),
  brand: z.string().max(255).nullish(),
  barcode: z.string().max(64).nullish()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = Number(getRouterParam(event, 'id'))

  const body = await parseBody(event, foodUpdateSchema)

  await loadEditableFood(db, userId, id)

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(foods)
      .set({ name: body.name, brand: body.brand ?? null, barcode: body.barcode ?? null })
      .where(eq(foods.id, id))
      .returning({ id: foods.id, name: foods.name, brand: foods.brand, barcode: foods.barcode })
      .then((r) => r[0]!)

    await enqueueSearchOutbox(tx, id, 'upsert')

    return updated
  })
})
