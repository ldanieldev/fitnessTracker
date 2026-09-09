import { foodNutrients, foods, foodServings } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { buildServingRows, foodCreateSchema } from '~~/server/utils/nutrition/foodInput'
import { nutrientIdMap } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, foodCreateSchema)

  let prepared
  try {
    prepared = buildServingRows(body.servings, await nutrientIdMap())
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }

  return db.transaction(async (tx) => {
    const food = await tx
      .insert(foods)
      .values({
        name: body.name,
        brand: body.brand ?? null,
        barcode: body.barcode ?? null,
        createdByUserId: userId
      })
      .returning()
      .then((r) => r[0]!)

    for (const serving of prepared) {
      const row = await tx
        .insert(foodServings)
        .values({
          foodId: food.id,
          kind: serving.kind,
          label: serving.label,
          quantity: String(serving.quantity),
          basisGrams: serving.basisGrams === null ? null : String(serving.basisGrams),
          hasOwnNutrition: serving.hasOwnNutrition,
          origin: serving.origin,
          sortOrder: serving.sortOrder
        })
        .returning()
        .then((r) => r[0]!)

      if (serving.nutrients.length) {
        await tx.insert(foodNutrients).values(
          serving.nutrients.map((n) => ({
            foodServingId: row.id,
            nutrientId: n.nutrientId,
            amount: String(n.amount)
          }))
        )
      }
    }

    await enqueueSearchOutbox(tx, food.id, 'upsert')

    return { id: food.id }
  })
})
