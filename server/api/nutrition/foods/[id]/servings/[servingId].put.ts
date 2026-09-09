import { and, eq } from 'drizzle-orm'
import { foodNutrients, foodServings } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { buildServingRows, servingInputSchema } from '~~/server/utils/nutrition/foodInput'
import { loadEditableFood } from '~~/server/utils/nutrition/loadEditableFood'
import { nutrientIdMap } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { assertCanReplaceServing, ServingInUseError } from '~~/server/utils/nutrition/servingGuards'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = Number(getRouterParam(event, 'id'))
  const servingId = Number(getRouterParam(event, 'servingId'))

  const body = await parseBody(event, servingInputSchema)

  const food = await loadEditableFood(db, userId, foodId)

  const target = food.servings.find((s) => s.id === servingId)
  if (!target) throw createError({ statusCode: 404, statusMessage: 'Serving not found' })

  if (body.kind === 'weight' && food.servings.some((s) => s.kind === 'weight' && s.id !== servingId)) {
    throw createError({ statusCode: 409, statusMessage: 'This food already has a weight serving' })
  }

  let prepared
  try {
    prepared = buildServingRows([body], await nutrientIdMap())
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
  const serving = prepared[0]!

  try {
    assertCanReplaceServing(food, servingId, {
      kind: serving.kind,
      basisGrams: serving.basisGrams,
      hasOwnNutrition: serving.hasOwnNutrition
    })
  } catch (err) {
    if (err instanceof ServingInUseError) {
      throw createError({ statusCode: 409, statusMessage: err.message })
    }
    throw createError({ statusCode: 404, statusMessage: 'Serving not found' })
  }

  return db.transaction(async (tx) => {
    await tx
      .update(foodServings)
      .set({
        kind: serving.kind,
        label: serving.label,
        quantity: String(serving.quantity),
        basisGrams: serving.basisGrams === null ? null : String(serving.basisGrams),
        hasOwnNutrition: serving.hasOwnNutrition,
        userModified: true
      })
      .where(and(eq(foodServings.id, servingId), eq(foodServings.foodId, foodId)))

    await tx.delete(foodNutrients).where(eq(foodNutrients.foodServingId, servingId))

    if (serving.nutrients.length) {
      await tx.insert(foodNutrients).values(
        serving.nutrients.map((n) => ({
          foodServingId: servingId,
          nutrientId: n.nutrientId,
          amount: String(n.amount)
        }))
      )
    }

    await enqueueSearchOutbox(tx, foodId, 'upsert')

    return { id: servingId }
  })
})
