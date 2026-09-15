import { and, eq, isNull } from 'drizzle-orm'
import { foodNutrients, foods, foodServings } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { loadFood } from '~~/server/utils/nutrition/loadFood'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { requireUserId } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const sourceId = Number(getRouterParam(event, 'id'))

  const source = await loadFood(db, userId, sourceId)
  if (!source) throw createError({ statusCode: 404, statusMessage: 'Food not found' })

  return db.transaction(async (tx) => {
    const head = await tx.select().from(foods).where(eq(foods.id, sourceId)).limit(1).then((r) => r[0]!)

    const copy = await tx
      .insert(foods)
      .values({
        name: head.name,
        brand: head.brand,
        barcode: head.barcode,
        sourceId: head.sourceId,
        externalId: head.externalId,
        createdByUserId: userId,
        forkedFromFoodId: sourceId
      })
      .returning()
      .then((r) => r[0]!)

    const servings = await tx
      .select()
      .from(foodServings)
      .where(and(eq(foodServings.foodId, sourceId), isNull(foodServings.deletedAt)))

    for (const serving of servings) {
      const row = await tx
        .insert(foodServings)
        .values({
          foodId: copy.id,
          kind: serving.kind,
          label: serving.label,
          quantity: serving.quantity,
          basisGrams: serving.basisGrams,
          hasOwnNutrition: serving.hasOwnNutrition,
          origin: serving.origin,
          userModified: serving.userModified,
          sortOrder: serving.sortOrder
        })
        .returning()
        .then((r) => r[0]!)

      const nutrientRows = await tx
        .select()
        .from(foodNutrients)
        .where(eq(foodNutrients.foodServingId, serving.id))

      if (nutrientRows.length) {
        await tx.insert(foodNutrients).values(
          nutrientRows.map((n) => ({ foodServingId: row.id, nutrientId: n.nutrientId, amount: n.amount }))
        )
      }
    }

    await enqueueSearchOutbox(tx, copy.id, 'upsert')

    return { id: copy.id }
  })
})
