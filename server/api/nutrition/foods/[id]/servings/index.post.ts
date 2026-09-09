import { and, eq, isNull } from 'drizzle-orm'
import { foodNutrients, foodServings } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { buildServingRows, servingInputSchema } from '~~/server/utils/nutrition/foodInput'
import { loadEditableFood } from '~~/server/utils/nutrition/loadEditableFood'
import { nutrientIdMap } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { enqueueSearchOutbox } from '~~/server/utils/nutrition/searchOutbox'
import { requireUserId } from '~~/server/utils/nutrition/session'
import { selectGramBasis } from '~~/shared/utils/nutritionResolve'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const foodId = Number(getRouterParam(event, 'id'))

  const body = await parseBody(event, servingInputSchema)

  const food = await loadEditableFood(db, userId, foodId)

  if (body.kind === 'weight' && food.servings.some((s) => s.kind === 'weight')) {
    throw createError({ statusCode: 409, statusMessage: 'This food already has a weight serving' })
  }

  let prepared
  try {
    prepared = buildServingRows([body], await nutrientIdMap())
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
  const serving = prepared[0]!

  if (!serving.hasOwnNutrition && selectGramBasis(food) === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This food has no gram basis, so a serving cannot derive its nutrition'
    })
  }

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ sortOrder: foodServings.sortOrder })
      .from(foodServings)
      .where(and(eq(foodServings.foodId, foodId), isNull(foodServings.deletedAt)))

    const nextSortOrder = existing.length ? Math.max(...existing.map((s) => s.sortOrder)) + 1 : 0

    const row = await tx
      .insert(foodServings)
      .values({
        foodId,
        kind: serving.kind,
        label: serving.label,
        quantity: String(serving.quantity),
        basisGrams: serving.basisGrams === null ? null : String(serving.basisGrams),
        hasOwnNutrition: serving.hasOwnNutrition,
        origin: serving.origin,
        sortOrder: nextSortOrder
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

    await enqueueSearchOutbox(tx, foodId, 'upsert')

    return { id: row.id }
  })
})
