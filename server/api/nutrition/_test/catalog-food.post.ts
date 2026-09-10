import { eq } from 'drizzle-orm'
import { foodSources } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { createFoodRecord } from '~~/server/utils/nutrition/createFood'
import { buildServingRows, foodCreateSchema } from '~~/server/utils/nutrition/foodInput'
import { nutrientIdMap } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/nutrition/session'

export default defineEventHandler(async (event) => {
  await requireUserId(event)
  if (process.env.NUXT_TEST_FIXTURES !== '1') throw createError({ statusCode: 404 })
  const body = await parseBody(event, foodCreateSchema)

  let prepared
  try {
    prepared = buildServingRows(body.servings, await nutrientIdMap())
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }

  const usdaSource = await db.select().from(foodSources).where(eq(foodSources.key, 'usda')).limit(1).then((r) => r[0])

  return db.transaction((tx) =>
    createFoodRecord(tx, {
      ownerId: null,
      sourceId: usdaSource?.id ?? null,
      externalId: null,
      barcode: body.barcode ?? null,
      name: body.name,
      brand: body.brand ?? null,
      prepared
    })
  )
})
