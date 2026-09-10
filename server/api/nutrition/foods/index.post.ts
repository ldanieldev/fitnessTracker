import { db } from '~~/server/utils/db'
import { createFoodRecord } from '~~/server/utils/nutrition/createFood'
import { buildServingRows, foodCreateSchema } from '~~/server/utils/nutrition/foodInput'
import { nutrientIdMap } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
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

  return db.transaction((tx) =>
    createFoodRecord(tx, {
      ownerId: userId,
      sourceId: null,
      externalId: null,
      barcode: body.barcode ?? null,
      name: body.name,
      brand: body.brand ?? null,
      prepared
    })
  )
})
