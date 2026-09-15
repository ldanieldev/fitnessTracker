import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { nutrients, userTrackedNutrients } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import { nutrientCatalog } from '~~/server/utils/nutrition/nutrientIds'
import { parseBody } from '~~/server/utils/nutrition/parseBody'
import { requireUserId } from '~~/server/utils/session'

const trackedSchema = z.object({ keys: z.array(z.string()).min(1).max(20) })

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const body = await parseBody(event, trackedSchema)

  const keys = [...new Set(body.keys)]

  const catalog = await nutrientCatalog()
  const byKey = new Map(catalog.map((n) => [n.key, n]))
  for (const key of keys) {
    if (!byKey.has(key)) {
      throw createError({ statusCode: 400, statusMessage: `Unknown nutrient: ${key}` })
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(userTrackedNutrients).where(eq(userTrackedNutrients.userId, userId))
    await tx.insert(userTrackedNutrients).values(
      keys.map((key, sortOrder) => ({
        userId,
        nutrientId: byKey.get(key)!.id,
        sortOrder
      }))
    )
  })

  return db
    .select({
      key: nutrients.key,
      name: nutrients.name,
      unit: nutrients.unit,
      sortOrder: userTrackedNutrients.sortOrder
    })
    .from(userTrackedNutrients)
    .innerJoin(nutrients, eq(nutrients.id, userTrackedNutrients.nutrientId))
    .where(eq(userTrackedNutrients.userId, userId))
    .orderBy(asc(userTrackedNutrients.sortOrder))
})
