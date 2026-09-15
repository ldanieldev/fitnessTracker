import { asc, eq } from 'drizzle-orm'
import { nutrients, userTrackedNutrients } from '~~/server/db/schema'
import type { DbClient } from '../db'
import { defaultTrackedNutrients, nutrientCatalog, type TrackedNutrientRow } from './nutrientIds'

export async function loadTrackedNutrients(client: DbClient, userId: number): Promise<TrackedNutrientRow[]> {
  const rows = await client
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

  if (rows.length) return rows

  return defaultTrackedNutrients(await nutrientCatalog())
}
